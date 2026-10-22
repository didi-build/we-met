/**
 * Cloudflare Email Sending Workers binding error codes we treat as auto-pause signals.
 * @see https://developers.cloudflare.com/email-service/api/send-emails/workers-api/#error-codes
 */
const PAUSE_ERROR_CODES = new Set(["E_RECIPIENT_SUPPRESSED", "E_ACCOUNT_SUSPENDED"]);

export const WARMUP_PAUSE_REASON_ASYNC_COMPLAINT = "async_complaint";
export const WARMUP_PAUSE_REASON_ASYNC_HARD_BOUNCE = "async_hard_bounce";

export function extractEmailSendErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) {
      return code;
    }
  }
  if (error instanceof Error) {
    const match = error.message.match(/\b(E_[A-Z0-9_]+)\b/);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

export function shouldPauseForSendError(errorCode: string | undefined): boolean {
  if (!errorCode) {
    return false;
  }
  if (PAUSE_ERROR_CODES.has(errorCode)) {
    return true;
  }
  const lower = errorCode.toLowerCase();
  return lower.includes("reputation") || lower.includes("suspended");
}

export function pauseReasonForSendError(errorCode: string): string {
  if (errorCode === "E_RECIPIENT_SUPPRESSED") {
    return "recipient_suppressed (hard bounce or spam complaint on Cloudflare suppression list)";
  }
  if (errorCode === "E_ACCOUNT_SUSPENDED") {
    return "account_suspended (Cloudflare Email Sending paused for reputation)";
  }
  return `send_error:${errorCode}`;
}
