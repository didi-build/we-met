import type { LeadEmailCapacityDenialReason } from "@/lead-email/availability";

/** Status class written to Workers Analytics Engine for POST /api/exchange (no PII). */
export type ExchangeOutcomeStatusClass =
  | "2xx"
  | "4xx"
  | "429"
  | "5xx"
  | "kill-switch 503"
  | "cap_reached"
  | "cap_config_error";

const EXCHANGE_OUTCOME_INDEX = "exchange_outcome";

export function exchangeOutcomeClassForLeadEmailDenial(
  reason: LeadEmailCapacityDenialReason,
): ExchangeOutcomeStatusClass {
  switch (reason) {
    case "kill_switch":
      return "kill-switch 503";
    case "cap_reached":
      return "cap_reached";
    case "cap_config_error":
      return "cap_config_error";
  }
}

/**
 * Records one exchange_outcome datapoint. Never throws; exchange responses must not depend on AE.
 */
export function writeExchangeOutcomeDataPoint(
  env: CloudflareEnv,
  statusClass: ExchangeOutcomeStatusClass,
): void {
  const dataset = env.WE_MET_EXCHANGE_OUTCOME_ANALYTICS;
  if (!dataset) {
    return;
  }
  try {
    dataset.writeDataPoint({
      indexes: [EXCHANGE_OUTCOME_INDEX],
      blobs: [statusClass],
      doubles: [1],
    });
  } catch {
    // Analytics must not affect exchange availability.
  }
}
