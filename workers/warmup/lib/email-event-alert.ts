import type { WarmupEnv, WarmupSecrets } from "./config";
import { escapeHtmlForEmail } from "./escape-html";
import { warmupEmailFrom } from "./from-address";
import {
  applyNonSeedAlertRateSuccess,
  planNonSeedAlertRate,
  writeNonSeedAlertWindow,
  WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR,
} from "./nonseed-alert-rate";
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

function summaryAlertContent(suppressedCount: number): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "We Met urgent: non-seed bounce/complaint alert rate limit";
  const cap = WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR;
  const text = [
    `More than ${cap} non-seed bounce or complaint events occurred within one hour.`,
    "",
    `Additional events suppressed in this window: ${suppressedCount}`,
    "",
    "Individual urgent alerts resume after the rolling hour window resets.",
    "Warm-up sending was not paused. Investigate app mail deliverability.",
  ].join("\n");
  const html = [
    `<p>More than ${escapeHtmlForEmail(String(cap))} non-seed bounce or complaint events occurred within one hour.</p>`,
    "<br>",
    `<p>Additional events suppressed in this window: ${escapeHtmlForEmail(String(suppressedCount))}</p>`,
    "<br>",
    "<p>Individual urgent alerts resume after the rolling hour window resets.</p>",
    "<p>Warm-up sending was not paused. Investigate app mail deliverability.</p>",
  ].join("");
  return { subject, text, html };
}

export async function sendNonSeedEmailEventAlertOnce(
  env: WarmupEnv,
  secrets: WarmupSecrets,
  context: NonSeedEmailEventAlertContext,
  now: Date = new Date(),
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

  const ratePlan = await planNonSeedAlertRate(kv, now.getTime());
  if (!ratePlan.ok) {
    console.error("warmup_email_event_alert_rate_read_failed", {
      eventType: context.eventType,
      recipient: context.recipientRedacted,
    });
    return "failed";
  }

  const { state, decision } = ratePlan;

  if (decision.action === "suppress") {
    const nextState = applyNonSeedAlertRateSuccess(state, decision);
    const windowWritten = await writeNonSeedAlertWindow(kv, nextState);
    if (!windowWritten) {
      return "failed";
    }
    const dedupeWritten = await writeNonSeedAlertDedupe(kv, context.dedupeKey, context);
    if (!dedupeWritten) {
      return "failed";
    }
    console.log("warmup_email_event_alert_rate_suppressed", {
      eventType: context.eventType,
      recipient: context.recipientRedacted,
      suppressedCount: nextState.suppressedCount,
    });
    return "suppressed";
  }

  const content =
    decision.action === "individual"
      ? individualAlertContent(context)
      : summaryAlertContent(decision.suppressedCount);

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

  const nextState = applyNonSeedAlertRateSuccess(state, decision);
  const windowWritten = await writeNonSeedAlertWindow(kv, nextState);
  if (!windowWritten) {
    return "failed";
  }

  const dedupeWritten = await writeNonSeedAlertDedupe(kv, context.dedupeKey, context);
  if (!dedupeWritten) {
    return "failed";
  }

  if (decision.action === "individual") {
    console.log("warmup_email_event_alert_sent", {
      eventType: context.eventType,
      recipient: context.recipientRedacted,
    });
    return "sent_individual";
  }

  console.log("warmup_email_event_alert_summary_sent", {
    eventType: context.eventType,
    recipient: context.recipientRedacted,
    suppressedCount: decision.suppressedCount,
  });
  return "sent_summary";
}

export function recipientRedactedForEmailEvent(recipient: string): string {
  return redactEmailForLog(recipient);
}
