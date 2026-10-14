import {
  followupEmailRetryDelaySeconds as followupEmailRetryDelaySecondsFromPolicy,
  MAX_VISITOR_FOLLOWUP_ATTEMPTS as MAX_VISITOR_FOLLOWUP_ATTEMPTS_FROM_POLICY,
} from "../../scripts/lib/queue-retry-policy.mjs";

export const MAX_VISITOR_FOLLOWUP_ATTEMPTS = MAX_VISITOR_FOLLOWUP_ATTEMPTS_FROM_POLICY;

/** Exponential backoff for queue retries (seconds), capped at 30 minutes. */
export function followupEmailRetryDelaySeconds(attempt: number): number {
  return followupEmailRetryDelaySecondsFromPolicy(attempt);
}
