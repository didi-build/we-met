import type { WarmupEnv } from "./config";

export const WARMUP_KV_ENABLED = "enabled";
export const WARMUP_KV_PAUSED = "paused";

export type WarmupPausedState = {
  reason: string;
  at: string;
  /** Set after the one-shot alert for this pause episode. */
  alertSent?: boolean;
};

export type WarmupGateResult =
  | { ok: true }
  | {
      ok: false;
      reason: "missing_kv" | "disabled" | "paused" | "kv_read_failed";
      paused?: WarmupPausedState;
    };

export async function readWarmupEnabled(
  kv: KVNamespace | undefined,
): Promise<boolean | null> {
  if (!kv) {
    return null;
  }
  try {
    const raw = await kv.get(WARMUP_KV_ENABLED);
    return raw === "true";
  } catch {
    return null;
  }
}

export async function readWarmupPaused(
  kv: KVNamespace | undefined,
): Promise<WarmupPausedState | null | "read_failed"> {
  if (!kv) {
    return null;
  }
  try {
    const raw = await kv.get(WARMUP_KV_PAUSED);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as WarmupPausedState;
    if (typeof parsed.reason !== "string" || typeof parsed.at !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return "read_failed";
  }
}

export async function checkWarmupSendGate(
  env: Pick<WarmupEnv, "WARMUP_STATE">,
): Promise<WarmupGateResult> {
  const kv = env.WARMUP_STATE;
  if (!kv) {
    return { ok: false, reason: "missing_kv" };
  }
  const enabled = await readWarmupEnabled(kv);
  if (enabled === null) {
    return { ok: false, reason: "kv_read_failed" };
  }
  if (!enabled) {
    return { ok: false, reason: "disabled" };
  }
  const paused = await readWarmupPaused(kv);
  if (paused === "read_failed") {
    return { ok: false, reason: "kv_read_failed" };
  }
  if (paused) {
    return { ok: false, reason: "paused", paused };
  }
  return { ok: true };
}

export async function writeWarmupPaused(
  kv: KVNamespace,
  state: WarmupPausedState,
): Promise<boolean> {
  try {
    await kv.put(WARMUP_KV_PAUSED, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export async function markWarmupPauseAlertSent(kv: KVNamespace): Promise<boolean> {
  const paused = await readWarmupPaused(kv);
  if (!paused || paused === "read_failed") {
    return false;
  }
  return writeWarmupPaused(kv, { ...paused, alertSent: true });
}
