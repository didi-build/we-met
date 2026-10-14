/** Visitor follow-up queue retry policy (shared by consumer code and deploy guards). */

export const FOLLOWUP_RETRY_BASE_DELAY_SECONDS = 30;
export const FOLLOWUP_RETRY_DELAY_CAP_SECONDS = 1800;
export const MAX_VISITOR_FOLLOWUP_ATTEMPTS = 30;
/** Margin under Workers Free 24h queue retention (seconds). */
export const FOLLOWUP_RETRY_RETENTION_BUDGET_SECONDS = 72_000;

/**
 * Delay in seconds before the next delivery after failed attempt n (1-based).
 * min(1800, 30 * 2^(n-1)).
 */
export function followupEmailRetryDelaySeconds(attempt) {
  const n = Math.max(1, Math.floor(Number(attempt)) || 1);
  return Math.min(
    FOLLOWUP_RETRY_DELAY_CAP_SECONDS,
    FOLLOWUP_RETRY_BASE_DELAY_SECONDS * 2 ** (n - 1),
  );
}

/**
 * Sum of retry delays after failed attempts 1..lastAttemptWithDelay (inclusive).
 * Through attempt 29 this is the worst-case delay before attempt 30.
 */
export function followupRetryWindowSecondsThroughAttempt(lastAttemptWithDelay) {
  let sum = 0;
  for (let n = 1; n <= lastAttemptWithDelay; n++) {
    sum += followupEmailRetryDelaySeconds(n);
  }
  return sum;
}

/** Worst-case retry delay window before the final (permanent-failure) attempt. */
export function followupRetryTotalWindowSeconds() {
  return followupRetryWindowSecondsThroughAttempt(MAX_VISITOR_FOLLOWUP_ATTEMPTS - 1);
}
