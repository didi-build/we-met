import type { FollowupEmailErrorCode } from "@/email/followup-email-error";

const NON_RETRYABLE_EXACT = new Set<FollowupEmailErrorCode>([
  "malformed_sink_email_config",
  "cloudflare_send_validation_failed",
]);

const CLOUDFLARE_NON_RETRYABLE_PREFIXES = ["E_HEADER_"];
const CLOUDFLARE_NON_RETRYABLE_EXACT = new Set([
  "E_RECIPIENT_SUPPRESSED",
  "E_CONTENT_TOO_LARGE",
]);

function cloudflareCodeFromErrorCode(code: FollowupEmailErrorCode): string | null {
  if (!code.startsWith("cloudflare_")) {
    return null;
  }
  return code.slice("cloudflare_".length);
}

export function isRetryableFollowupEmailError(code: FollowupEmailErrorCode): boolean {
  if (NON_RETRYABLE_EXACT.has(code)) {
    return false;
  }
  const cloudflareCode = cloudflareCodeFromErrorCode(code);
  if (cloudflareCode === null) {
    return true;
  }
  if (CLOUDFLARE_NON_RETRYABLE_EXACT.has(cloudflareCode)) {
    return false;
  }
  if (
    CLOUDFLARE_NON_RETRYABLE_PREFIXES.some((prefix) =>
      cloudflareCode.startsWith(prefix),
    )
  ) {
    return false;
  }
  return true;
}
