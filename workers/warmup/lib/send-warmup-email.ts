import { assertSeedRecipient } from "./allowlist";
import type { WarmupEnv } from "./config";
import { warmupEmailFrom } from "./from-address";
import { extractEmailSendErrorCode, isPermanentWarmupSendError } from "./send-error";
import { redactEmailForLog } from "./redact-email";

export type WarmupSendPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type WarmupSendResult =
  | { ok: true; messageId: string }
  | {
      ok: false;
      code: "missing_secrets" | "not_in_seeds" | "missing_binding" | "send_failed";
      errorCode?: string;
      permanent?: boolean;
    };

export async function sendWarmupEmail(
  env: WarmupEnv,
  secrets: { seeds: string[]; from: string },
  payload: WarmupSendPayload,
): Promise<WarmupSendResult> {
  const allow = assertSeedRecipient(payload.to, secrets.seeds);
  if (!allow.ok) {
    console.warn("warmup_send_rejected", {
      reason: allow.reason,
      to: allow.redacted,
    });
    return { ok: false, code: "not_in_seeds" };
  }

  if (!env.EMAIL) {
    console.warn("warmup_send_skipped", { reason: "missing_email_binding" });
    return { ok: false, code: "missing_binding" };
  }

  try {
    const result = await env.EMAIL.send({
      from: warmupEmailFrom(secrets.from),
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    console.log("warmup_send_ok", {
      messageId: result.messageId,
      to: redactEmailForLog(payload.to),
    });
    return { ok: true, messageId: result.messageId };
  } catch (error) {
    const errorCode = extractEmailSendErrorCode(error);
    console.error("warmup_send_failed", {
      to: redactEmailForLog(payload.to),
      error: error instanceof Error ? error.message : "unknown",
      errorCode,
    });
    const permanent = isPermanentWarmupSendError(error);
    return { ok: false, code: "send_failed", errorCode, permanent };
  }
}
