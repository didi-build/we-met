/** Max individual non-seed urgent alerts per rolling hour (DIDI-724). */
export const WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR = 5;

export const WARMUP_NONSEED_ALERT_WINDOW_MS = 60 * 60 * 1000;

export const WARMUP_KV_NONSEED_ALERT_WINDOW = "nonseed_alert:window";

/** TTL slightly longer than the window so stale state expires without unbounded growth. */
export const WARMUP_NONSEED_ALERT_WINDOW_KV_TTL_SECONDS =
  WARMUP_NONSEED_ALERT_WINDOW_MS / 1000 + 15 * 60;

export type NonSeedAlertWindowState = {
  windowStartMs: number;
  individualSent: number;
  summarySent: boolean;
  suppressedCount: number;
};

export type NonSeedAlertRateDecision =
  | { action: "individual" }
  | { action: "summary"; suppressedCount: number }
  | { action: "suppress" };

function emptyWindow(windowStartMs: number): NonSeedAlertWindowState {
  return {
    windowStartMs,
    individualSent: 0,
    summarySent: false,
    suppressedCount: 0,
  };
}

export function normalizeNonSeedAlertWindow(
  raw: NonSeedAlertWindowState | null,
  nowMs: number,
): NonSeedAlertWindowState {
  if (!raw) {
    return emptyWindow(nowMs);
  }
  if (nowMs - raw.windowStartMs >= WARMUP_NONSEED_ALERT_WINDOW_MS) {
    return emptyWindow(nowMs);
  }
  return raw;
}

export function decideNonSeedAlertRate(
  state: NonSeedAlertWindowState,
): NonSeedAlertRateDecision {
  if (state.individualSent < WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR) {
    return { action: "individual" };
  }
  if (!state.summarySent) {
    return { action: "summary", suppressedCount: state.suppressedCount + 1 };
  }
  return { action: "suppress" };
}

function parseWindow(raw: string | null): NonSeedAlertWindowState | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<NonSeedAlertWindowState>;
    if (
      typeof parsed.windowStartMs !== "number" ||
      !Number.isFinite(parsed.windowStartMs) ||
      typeof parsed.individualSent !== "number" ||
      !Number.isFinite(parsed.individualSent) ||
      parsed.individualSent < 0 ||
      typeof parsed.summarySent !== "boolean" ||
      typeof parsed.suppressedCount !== "number" ||
      !Number.isFinite(parsed.suppressedCount) ||
      parsed.suppressedCount < 0
    ) {
      return null;
    }
    return {
      windowStartMs: parsed.windowStartMs,
      individualSent: parsed.individualSent,
      summarySent: parsed.summarySent,
      suppressedCount: parsed.suppressedCount,
    };
  } catch {
    return null;
  }
}

export async function readNonSeedAlertWindow(
  kv: KVNamespace,
): Promise<NonSeedAlertWindowState | null | "read_failed"> {
  try {
    const raw = await kv.get(WARMUP_KV_NONSEED_ALERT_WINDOW);
    if (raw === null) {
      return null;
    }
    const parsed = parseWindow(raw);
    return parsed ?? null;
  } catch {
    return "read_failed";
  }
}

export async function writeNonSeedAlertWindow(
  kv: KVNamespace,
  state: NonSeedAlertWindowState,
): Promise<boolean> {
  try {
    await kv.put(WARMUP_KV_NONSEED_ALERT_WINDOW, JSON.stringify(state), {
      expirationTtl: WARMUP_NONSEED_ALERT_WINDOW_KV_TTL_SECONDS,
    });
    return true;
  } catch {
    return false;
  }
}

/** Read window, apply rolling reset, and return the rate decision for this alert attempt. */
export async function planNonSeedAlertRate(
  kv: KVNamespace,
  nowMs: number,
): Promise<
  | { ok: true; state: NonSeedAlertWindowState; decision: NonSeedAlertRateDecision }
  | { ok: false; reason: "read_failed" }
> {
  const read = await readNonSeedAlertWindow(kv);
  if (read === "read_failed") {
    return { ok: false, reason: "read_failed" };
  }
  const state = normalizeNonSeedAlertWindow(read, nowMs);
  const decision = decideNonSeedAlertRate(state);
  return { ok: true, state, decision };
}

export function applyNonSeedAlertRateSuccess(
  state: NonSeedAlertWindowState,
  decision: NonSeedAlertRateDecision,
): NonSeedAlertWindowState {
  if (decision.action === "individual") {
    return { ...state, individualSent: state.individualSent + 1 };
  }
  if (decision.action === "summary") {
    return {
      ...state,
      summarySent: true,
      suppressedCount: state.suppressedCount + 1,
    };
  }
  return { ...state, suppressedCount: state.suppressedCount + 1 };
}
