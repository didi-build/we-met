import type { WarmupEnv, WarmupSecrets } from "./config";
import { escapeHtmlForEmail } from "./escape-html";
import { warmupEmailFrom } from "./from-address";
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

export async function sendNonSeedEmailEventAlertOnce(
  env: WarmupEnv,
  secrets: WarmupSecrets,
  context: NonSeedEmailEventAlertContext,
): Promise<boolean> {
  const kv = env.WARMUP_STATE;
  if (!kv) {
    return false;
  }
  const existing = await kv.get(context.dedupeKey);
  if (existing) {
    return false;
  }

  const alertTo = env.WARMUP_ALERT_TO?.trim();
  if (!alertTo || !env.EMAIL) {
    console.warn("warmup_email_event_alert_skipped", {
      reason: !alertTo ? "missing_alert_to" : "missing_email_binding",
      eventType: context.eventType,
      recipient: context.recipientRedacted,
    });
    return false;
  }

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

  try {
    await env.EMAIL.send({
      from: warmupEmailFrom(secrets.from),
      to: alertTo,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("warmup_email_event_alert_failed", {
      eventType: context.eventType,
      recipient: context.recipientRedacted,
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }

  try {
    await kv.put(context.dedupeKey, new Date().toISOString(), {
      expirationTtl: WARMUP_NONSEED_ALERT_DEDUPE_TTL_SECONDS,
    });
  } catch (error) {
    console.error("warmup_email_event_alert_dedupe_write_failed", {
      eventType: context.eventType,
      recipient: context.recipientRedacted,
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }

  console.log("warmup_email_event_alert_sent", {
    eventType: context.eventType,
    recipient: context.recipientRedacted,
  });
  return true;
}

export function recipientRedactedForEmailEvent(recipient: string): string {
  return redactEmailForLog(recipient);
}
