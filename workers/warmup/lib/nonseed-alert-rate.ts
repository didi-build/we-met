import { parseWarmupNonSeedAlertMaxIndividualPerHour, type WarmupEnv } from "./config";

export const WARMUP_NONSEED_ALERT_WINDOW_MS = 60 * 60 * 1000;

export const WARMUP_KV_NONSEED_ALERT_WINDOW = "nonseed_alert:window";

/** TTL slightly longer than the sliding hour so stale state expires without unbounded growth. */
export const WARMUP_NONSEED_ALERT_WINDOW_KV_TTL_SECONDS =
  WARMUP_NONSEED_ALERT_WINDOW_MS / 1000 + 15 * 60;

export type NonSeedAlertWindowState = {
  /** Send times (ms) for individual alerts still inside the sliding hour. */
  individualAlertAtMs: number[];
  /** One-shot summary for the current over-cap period (until slots free up). */
  summarySent: boolean;
  /** Non-seed events after the summary email until the sliding window frees individual slots. */
  suppressedCount: number;
};

export type NonSeedAlertRateDecision =
  | { action: "individual" }
  | { action: "summary"; eventsSeenInWindow: number }
  | { action: "suppress" };

function emptyWindow(): NonSeedAlertWindowState {
  return {
    individualAlertAtMs: [],
    summarySent: false,
    suppressedCount: 0,
  };
}

export function pruneIndividualAlertTimes(
  individualAlertAtMs: number[],
  nowMs: number,
): number[] {
  const cutoff = nowMs - WARMUP_NONSEED_ALERT_WINDOW_MS;
  return individualAlertAtMs.filter((at) => at > cutoff);
}

export type RefreshSlidingWindowResult = {
  state: NonSeedAlertWindowState;
  /** Logged when an over-cap period ends because individual slots freed up. */
  windowClosed?: { suppressedCount: number };
};

export function refreshSlidingWindowState(
  raw: NonSeedAlertWindowState,
  nowMs: number,
  maxIndividual: number,
): RefreshSlidingWindowResult {
  const pruned = pruneIndividualAlertTimes(raw.individualAlertAtMs, nowMs);
  let summarySent = raw.summarySent;
  let suppressedCount = raw.suppressedCount;
  let windowClosed: { suppressedCount: number } | undefined;

  if (pruned.length < maxIndividual && (summarySent || suppressedCount > 0)) {
    if (summarySent) {
      windowClosed = { suppressedCount };
    }
    summarySent = false;
    suppressedCount = 0;
  }

  return {
    state: {
      individualAlertAtMs: pruned,
      summarySent,
      suppressedCount,
    },
    windowClosed,
  };
}

export function decideNonSeedAlertRate(
  state: NonSeedAlertWindowState,
  maxIndividual: number,
): NonSeedAlertRateDecision {
  if (state.individualAlertAtMs.length < maxIndividual) {
    return { action: "individual" };
  }
  if (!state.summarySent) {
    return {
      action: "summary",
      eventsSeenInWindow: state.individualAlertAtMs.length + 1,
    };
  }
  return { action: "suppress" };
}

export function applyNonSeedAlertRateSuccess(
  state: NonSeedAlertWindowState,
  decision: NonSeedAlertRateDecision,
  nowMs: number,
): NonSeedAlertWindowState {
  if (decision.action === "individual") {
    return {
      ...state,
      individualAlertAtMs: [...state.individualAlertAtMs, nowMs],
    };
  }
  if (decision.action === "summary") {
    return {
      ...state,
      summarySent: true,
      suppressedCount: 1,
    };
  }
  return { ...state, suppressedCount: state.suppressedCount + 1 };
}

function parseWindow(raw: string | null): NonSeedAlertWindowState | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const timesRaw = parsed.individualAlertAtMs;
    if (!Array.isArray(timesRaw)) {
      return null;
    }
    const individualAlertAtMs: number[] = [];
    for (const entry of timesRaw) {
      if (typeof entry !== "number" || !Number.isFinite(entry)) {
        return null;
      }
      individualAlertAtMs.push(entry);
    }
    if (
      typeof parsed.summarySent !== "boolean" ||
      typeof parsed.suppressedCount !== "number" ||
      !Number.isFinite(parsed.suppressedCount) ||
      parsed.suppressedCount < 0
    ) {
      return null;
    }
    return {
      individualAlertAtMs,
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

export class NonSeedAlertRateSession {
  private state: NonSeedAlertWindowState;
  private dirty = false;
  private readonly maxIndividual: number;
  private readonly nowMs: number;

  private constructor(
    state: NonSeedAlertWindowState,
    maxIndividual: number,
    nowMs: number,
    windowClosed?: { suppressedCount: number },
  ) {
    this.state = state;
    this.maxIndividual = maxIndividual;
    this.nowMs = nowMs;
    if (windowClosed) {
      console.log("warmup_email_event_alert_window_closed", {
        suppressedCount: windowClosed.suppressedCount,
      });
    }
  }

  static async open(
    kv: KVNamespace,
    env: Pick<WarmupEnv, "WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR">,
    nowMs: number,
  ): Promise<NonSeedAlertRateSession | "read_failed"> {
    const read = await readNonSeedAlertWindow(kv);
    if (read === "read_failed") {
      return "read_failed";
    }
    const maxIndividual = parseWarmupNonSeedAlertMaxIndividualPerHour(env);
    const base = read ?? emptyWindow();
    const refreshed = refreshSlidingWindowState(base, nowMs, maxIndividual);
    return new NonSeedAlertRateSession(
      refreshed.state,
      maxIndividual,
      nowMs,
      refreshed.windowClosed,
    );
  }

  get maxIndividualPerHour(): number {
    return this.maxIndividual;
  }

  isDirty(): boolean {
    return this.dirty;
  }

  get suppressedCount(): number {
    return this.state.suppressedCount;
  }

  plan(): NonSeedAlertRateDecision {
    const refreshed = refreshSlidingWindowState(
      this.state,
      this.nowMs,
      this.maxIndividual,
    );
    if (refreshed.windowClosed) {
      console.log("warmup_email_event_alert_window_closed", {
        suppressedCount: refreshed.windowClosed.suppressedCount,
      });
    }
    this.state = refreshed.state;
    return decideNonSeedAlertRate(this.state, this.maxIndividual);
  }

  applySuccess(decision: NonSeedAlertRateDecision): void {
    this.state = applyNonSeedAlertRateSuccess(this.state, decision, this.nowMs);
    this.dirty = true;
  }

  async commit(kv: KVNamespace): Promise<boolean> {
    if (!this.dirty) {
      return true;
    }
    const written = await writeNonSeedAlertWindow(kv, this.state);
    if (written) {
      this.dirty = false;
    }
    return written;
  }
}
