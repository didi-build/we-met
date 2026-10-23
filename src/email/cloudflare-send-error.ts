const PERMANENT_SEND_MESSAGE_PATTERNS = [
  /Incorrect type for/i,
  /not of type ['"]string['"]/i,
  /validation failed/i,
] as const;

function permanentSendErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "";
}

/** Cloudflare Email Sending binding errors that will not succeed on queue retry. */
export function isPermanentCloudflareSendError(error: unknown): boolean {
  const message = permanentSendErrorMessage(error);
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
