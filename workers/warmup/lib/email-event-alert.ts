import type { WarmupEnv, WarmupSecrets } from "./config";
import { escapeHtmlForEmail } from "./escape-html";
import { warmupEmailFrom } from "./from-address";
import { NonSeedAlertRateSession } from "./nonseed-alert-rate";
import { redactEmailForLog } from "./redact-email";

/** Dedupe non-seed urgent alerts per Email Sending message id (separate from pause-episode dedupe). */
export const WARMUP_KV_NONSEED_ALERT_PREFIX = "nonseed_alert:msg:";

/** Keep dedupe keys long enough to cover queue retries and operator follow-up. */
export const WARMUP_NONSEED_ALERT_DEDUPE_TTL_SECONDS = 30 * 24 * 60 * 60;

export type NonSeedEmailEventAlertContext = {
  dedupeKey: string;
  eventType: string;
  recipientRedacted: string;
};

export type NonSeedEmailEventAlertResult =
  "sent_individual" | "sent_summary" | "suppressed" | "deduped" | "skipped" | "failed";

export type NonSeedEmailEventAlertOptions = {
  now?: Date;
  /** When set, window state is updated in memory and committed by the batch caller. */
  rateSession?: NonSeedAlertRateSession | null;
  /** When true, commit the rate session after this call (single-message path). */
  commitRateSession?: boolean;
};

export function nonSeedAlertDedupeKey(messageId: string): string {
  return `${WARMUP_KV_NONSEED_ALERT_PREFIX}${messageId}`;
}

export function resolveEmailEventDedupeId(payload: {
  messageId?: string;
  eventId?: string;
}): string | null {
  const messageId = payload.messageId?.trim();
  if (messageId) {
    return messageId;
  }
  const eventId = payload.eventId?.trim();
  if (eventId) {
    return eventId;
  }
  return null;
}

async function writeNonSeedAlertDedupe(
  kv: KVNamespace,
  dedupeKey: string,
  context: Pick<NonSeedEmailEventAlertContext, "eventType" | "recipientRedacted">,
): Promise<boolean> {
  try {
    await kv.put(dedupeKey, new Date().toISOString(), {
      expirationTtl: WARMUP_NONSEED_ALERT_DEDUPE_TTL_SECONDS,
    });
    return true;
  } catch (error) {
    console.error("warmup_email_event_alert_dedupe_write_failed", {
      eventType: context.eventType,
      recipient: context.recipientRedacted,
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

async function commitRateSessionIfNeeded(
  kv: KVNamespace,
  session: NonSeedAlertRateSession,
  shouldCommit: boolean,
  context: Pick<NonSeedEmailEventAlertContext, "eventType" | "recipientRedacted">,
): Promise<boolean> {
  if (!shouldCommit || !session.isDirty()) {
    return true;
  }
  const written = await session.commit(kv);
  if (!written) {
    console.error("warmup_email_event_alert_window_write_failed", {
      eventType: context.eventType,
      recipient: context.recipientRedacted,
    });
  }
  return written;
}

function individualAlertContent(context: NonSeedEmailEventAlertContext): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "We Met urgent: app mail bounce or complaint";
  const dedupeId = context.dedupeKey.slice(WARMUP_KV_NONSEED_ALERT_PREFIX.length);
  const text = [
    "Cloudflare Email Sending reported a bounce or complaint for a non-seed recipient.",
    "",
    `Event type: ${context.eventType}`,
    `Recipient (redacted): ${context.recipientRedacted}`,
    `Dedupe id: ${dedupeId}`,
    "",
    "Warm-up sending was not paused. Investigate app mail deliverability.",
  ].join("\n");
  const html = [
    "<p>Cloudflare Email Sending reported a bounce or complaint for a non-seed recipient.</p>",
    "<br>",
    `<p>Event type: ${escapeHtmlForEmail(context.eventType)}</p>`,
    `<p>Recipient (redacted): ${escapeHtmlForEmail(context.recipientRedacted)}</p>`,
    `<p>Dedupe id: ${escapeHtmlForEmail(dedupeId)}</p>`,
    "<br>",
    "<p>Warm-up sending was not paused. Investigate app mail deliverability.</p>",
  ].join("");
  return { subject, text, html };
}

function summaryAlertContent(
  maxIndividual: number,
  eventsSeenInWindow: number,
): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "We Met urgent: non-seed bounce/complaint alert rate limit";
  const text = [
    `${eventsSeenInWindow} non-seed bounce or complaint events occurred within the last hour (individual alert limit: ${maxIndividual}).`,
    "",
    "Further events in this period are logged only, not emailed, until individual slots free up as earlier sends age out of the sliding hour.",
    "",
    "Warm-up sending was not paused. Investigate app mail deliverability.",
  ].join("\n");
  const html = [
    `<p>${escapeHtmlForEmail(String(eventsSeenInWindow))} non-seed bounce or complaint events occurred within the last hour (individual alert limit: ${escapeHtmlForEmail(String(maxIndividual))}).</p>`,
    "<br>",
    "<p>Further events in this period are logged only, not emailed, until individual slots free up as earlier sends age out of the sliding hour.</p>",
    "<br>",
    "<p>Warm-up sending was not paused. Investigate app mail deliverability.</p>",
  ].join("");
  return { subject, text, html };
}

export async function sendNonSeedEmailEventAlertOnce(
  env: WarmupEnv,
  secrets: WarmupSecrets,
  context: NonSeedEmailEventAlertContext,
  options: NonSeedEmailEventAlertOptions = {},
): Promise<NonSeedEmailEventAlertResult> {
  const kv = env.WARMUP_STATE;
  if (!kv) {
    return "failed";
  }
  const existing = await kv.get(context.dedupeKey);
  if (existing) {
    return "deduped";
  }

  const alertTo = env.WARMUP_ALERT_TO?.trim();
  if (!alertTo || !env.EMAIL) {
    console.warn("warmup_email_event_alert_skipped", {
      reason: !alertTo ? "missing_alert_to" : "missing_email_binding",
      eventType: context.eventType,
      recipient: context.recipientRedacted,
    });
    return "skipped";
  }

  const nowMs = (options.now ?? new Date()).getTime();
  let session = options.rateSession ?? null;
  const commitAfterCall = options.commitRateSession ?? session === null;
  if (!session) {
    const opened = await NonSeedAlertRateSession.open(kv, env, nowMs);
    if (opened === "read_failed") {
      console.error("warmup_email_event_alert_rate_read_failed", {
        eventType: context.eventType,
        recipient: context.recipientRedacted,
      });
      return "failed";
    }
    session = opened;
  }

  const decision = session.plan();

  if (decision.action === "suppress") {
    session.applySuccess(decision);
    const dedupeWritten = await writeNonSeedAlertDedupe(kv, context.dedupeKey, context);
    if (!dedupeWritten) {
      return "failed";
    }
    await commitRateSessionIfNeeded(kv, session, commitAfterCall, context);
    console.log("warmup_email_event_alert_rate_suppressed", {
      eventType: context.eventType,
      recipient: context.recipientRedacted,
      suppressedCount: session.suppressedCount,
    });
    return "suppressed";
  }

  const content =
    decision.action === "individual"
      ? individualAlertContent(context)
      : summaryAlertContent(session.maxIndividualPerHour, decision.eventsSeenInWindow);

  try {
    await env.EMAIL.send({
      from: warmupEmailFrom(secrets.from),
      to: alertTo,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  } catch (error) {
    console.error("warmup_email_event_alert_failed", {
      eventType: context.eventType,
      recipient: context.recipientRedacted,
      rateAction: decision.action,
      error: error instanceof Error ? error.message : "unknown",
    });
    return "failed";
  }

  session.applySuccess(decision);
  const dedupeWritten = await writeNonSeedAlertDedupe(kv, context.dedupeKey, context);
  if (!dedupeWritten) {
    return "failed";
  }
  await commitRateSessionIfNeeded(kv, session, commitAfterCall, context);

  if (decision.action === "individual") {
    console.log("warmup_email_event_alert_sent", {
      eventType: context.eventType,
      recipient: context.recipientRedacted,
    });
    return "sent_individual";
  }

  console.log("warmup_email_event_alert_summary_sent", {
    eventsSeenInWindow: decision.eventsSeenInWindow,
  });
  return "sent_summary";
}

export function recipientRedactedForEmailEvent(recipient: string): string {
  return redactEmailForLog(recipient);
}
