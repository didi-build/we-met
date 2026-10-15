import { FOLLOWUP_RETRY_RETENTION_BUDGET_SECONDS } from "../../scripts/lib/queue-retry-policy.mjs";

export function computeLeadDeliveryRetryUntilIso(enqueuedAt: Date): string {
  const untilMs = enqueuedAt.getTime() + FOLLOWUP_RETRY_RETENTION_BUDGET_SECONDS * 1000;
  return new Date(untilMs).toISOString();
}
