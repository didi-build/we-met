/** Exponential backoff for queue retries (seconds), capped at 15 minutes. */
export function followupEmailRetryDelaySeconds(attempt: number): number {
  return Math.min(900, 30 * 2 ** Math.max(0, attempt - 1));
}

export const MAX_VISITOR_FOLLOWUP_ATTEMPTS = 5;
