const PERMANENT_SEND_MESSAGE_PATTERNS = [
  /Incorrect type for/i,
  /not of type ['"]string['"]/i,
  /validation failed/i,
] as const;

/** Cloudflare Email Sending binding errors that will not succeed on queue retry. */
export function isPermanentCloudflareSendError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (message.length === 0) {
    return false;
  }
  for (const pattern of PERMANENT_SEND_MESSAGE_PATTERNS) {
    if (pattern.test(message)) {
      return true;
    }
  }
  return false;
}
