import type { WarmupEnv } from "./config";

export const WARMUP_KV_ENABLED = "enabled";
export const WARMUP_KV_PAUSED = "paused";
export const WARMUP_KV_PAUSED_ALERT = "paused_alert";
export const WARMUP_KV_PAUSED_ALERT_ATTEMPT = "paused_alert_attempt";

/** Cooldown before retrying pause alert after a send or guard write (6 hours). */
export const WARMUP_ALERT_RETRY_COOLDOWN_SECONDS = 21_600;

export type WarmupPausedState = {
  reason: string;
  at: string;
  /** Legacy: set after the one-shot alert for this pause episode (prefer `paused_alert` KV). */
  alertSent?: boolean;
};

/** Non-empty `paused` KV that failed validation; keeps sending off until the key is deleted. */
export const WARMUP_INVALID_PAUSED_STATE: WarmupPausedState = {
  reason: "invalid_paused_kv_value",
  at: "1970-01-01T00:00:00.000Z",
};

export type WarmupPausedReadResult = {
  state: WarmupPausedState;
  raw: string;
};

export type WarmupPausedAlertState = {
  episode: string;
  sentAt: string;
};

export type WarmupPausedAlertAttemptState = {
  episode: string;
  at: string;
};

function parseWarmupPausedValue(raw: string): WarmupPausedState {
  try {
    const parsed = JSON.parse(raw) as WarmupPausedState;
    if (typeof parsed.reason === "string" && typeof parsed.at === "string") {
      return parsed;
    }
  } catch {
    // fall through to invalid
  }
  return WARMUP_INVALID_PAUSED_STATE;
}

export function isWarmupInvalidPausedState(state: WarmupPausedState): boolean {
  return (
    state.reason === WARMUP_INVALID_PAUSED_STATE.reason &&
    state.at === WARMUP_INVALID_PAUSED_STATE.at
  );
}

export async function warmupPausedEpisodeId(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

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
): Promise<WarmupPausedReadResult | null | "read_failed"> {
  if (!kv) {
    return null;
  }
  try {
    const raw = await kv.get(WARMUP_KV_PAUSED);
    if (!raw) {
      return null;
    }
    return { state: parseWarmupPausedValue(raw), raw };
  } catch {
    return "read_failed";
  }
}

export async function readWarmupPausedAlert(
  kv: KVNamespace,
): Promise<WarmupPausedAlertState | null | "read_failed"> {
  let raw: string | null;
  try {
    raw = await kv.get(WARMUP_KV_PAUSED_ALERT);
  } catch {
    return "read_failed";
  }
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as WarmupPausedAlertState;
    if (typeof parsed.episode === "string" && typeof parsed.sentAt === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeWarmupPausedAlert(
  kv: KVNamespace,
  episode: string,
  sentAt: string,
): Promise<boolean> {
  try {
    await kv.put(
      WARMUP_KV_PAUSED_ALERT,
      JSON.stringify({ episode, sentAt } satisfies WarmupPausedAlertState),
    );
    return true;
  } catch {
    return false;
  }
}

export async function readWarmupPausedAlertAttempt(
  kv: KVNamespace,
): Promise<WarmupPausedAlertAttemptState | null | "read_failed"> {
  let raw: string | null;
  try {
    raw = await kv.get(WARMUP_KV_PAUSED_ALERT_ATTEMPT);
  } catch {
    return "read_failed";
  }
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as WarmupPausedAlertAttemptState;
    if (typeof parsed.episode === "string" && typeof parsed.at === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeWarmupPausedAlertAttempt(
  kv: KVNamespace,
  episode: string,
  at: string,
): Promise<boolean> {
  try {
    await kv.put(
      WARMUP_KV_PAUSED_ALERT_ATTEMPT,
      JSON.stringify({ episode, at } satisfies WarmupPausedAlertAttemptState),
      { expirationTtl: WARMUP_ALERT_RETRY_COOLDOWN_SECONDS },
    );
    return true;
  } catch {
    return false;
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
    return { ok: false, reason: "paused", paused: paused.state };
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
