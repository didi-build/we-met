import { isAllowedWarmupFromAddress, logInvalidWarmupFrom } from "./from-address";

export type WarmupSecrets = {
  seeds: string[];
  from: string;
};

export const WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR_DEFAULT = 5;

export type WarmupEnv = {
  WARMUP_SEEDS?: string;
  WARMUP_FROM?: string;
  /** Alert recipient when auto-pause triggers (Wrangler secret; never commit). */
  WARMUP_ALERT_TO?: string;
  /**
   * Optional cap on individual non-seed bounce/complaint urgent alerts per sliding hour.
   * Wrangler secret or var; unset defaults to 5 (see parseWarmupNonSeedAlertMaxIndividualPerHour).
   */
  WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR?: string;
  EMAIL?: {
    send(message: {
      from: { email: string; name?: string } | string;
      to: string;
      subject: string;
      text: string;
      html: string;
    }): Promise<{ messageId: string }>;
  };
  WARMUP_STATE?: KVNamespace;
  WARMUP_SEND_QUEUE?: Queue<WarmupQueueBody>;
  WARMUP_DLQ?: Queue<WarmupDlqBody>;
};

export type WarmupQueueBody = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attempt: number;
};

export type WarmupDlqBody = {
  reason: string;
  toRedacted: string;
  at: string;
};

export function parseWarmupSecrets(
  env: Pick<WarmupEnv, "WARMUP_SEEDS" | "WARMUP_FROM">,
): WarmupSecrets | null {
  const seedsRaw = env.WARMUP_SEEDS?.trim();
  const from = env.WARMUP_FROM?.trim();
  if (!seedsRaw || !from) {
    return null;
  }
  if (!isAllowedWarmupFromAddress(from)) {
    logInvalidWarmupFrom(from);
    return null;
  }
  const seeds = seedsRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  if (seeds.length === 0) {
    return null;
  }
  return { seeds, from };
}

export function parseWarmupNonSeedAlertMaxIndividualPerHour(
  env: Pick<WarmupEnv, "WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR">,
): number {
  const raw = env.WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR?.trim();
  if (!raw) {
    return WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR_DEFAULT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    console.warn("warmup_nonseed_alert_max_per_hour_default", {
      reason: "invalid",
    });
    return WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR_DEFAULT;
  }
  if (parsed <= 0) {
    console.warn("warmup_nonseed_alert_max_per_hour_default", {
      reason: "non_positive",
    });
    return WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR_DEFAULT;
  }
  return parsed;
}
