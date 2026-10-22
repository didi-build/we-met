import { isAllowedWarmupFromAddress, logInvalidWarmupFrom } from "./from-address";

export type WarmupSecrets = {
  seeds: string[];
  from: string;
};

export type WarmupEnv = {
  WARMUP_SEEDS?: string;
  WARMUP_FROM?: string;
  /** Alert recipient when auto-pause triggers (Wrangler secret; never commit). */
  WARMUP_ALERT_TO?: string;
  EMAIL?: {
    send(message: {
      from: { email: string };
      to: string;
      subject: string;
      text: string;
      html: string;
    }): Promise<{ messageId: string }>;
  };
  WARMUP_STATE?: KVNamespace;
  WARMUP_SEND_QUEUE?: Queue<WarmupQueueBody>;
  WARMUP_DLQ?: Queue<WarmupDlqBody>;
  WARMUP_EMAIL_EVENTS_DLQ?: Queue<unknown>;
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
