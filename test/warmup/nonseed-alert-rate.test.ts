import { describe, expect, it, vi } from "vitest";
import {
  WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR_DEFAULT,
  parseWarmupNonSeedAlertMaxIndividualPerHour,
} from "../../workers/warmup/lib/config";
import {
  decideNonSeedAlertRate,
  refreshSlidingWindowState,
  WARMUP_NONSEED_ALERT_WINDOW_MS,
} from "../../workers/warmup/lib/nonseed-alert-rate";

describe("warmup non-seed alert rate (unit)", () => {
  it("parses WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR with default fallback", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseWarmupNonSeedAlertMaxIndividualPerHour({})).toBe(
      WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR_DEFAULT,
    );
    expect(
      parseWarmupNonSeedAlertMaxIndividualPerHour({
        WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR: "2",
      }),
    ).toBe(2);
    expect(
      parseWarmupNonSeedAlertMaxIndividualPerHour({
        WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR: "0",
      }),
    ).toBe(5);
    expect(
      parseWarmupNonSeedAlertMaxIndividualPerHour({
        WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR: "nope",
      }),
    ).toBe(5);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("uses a sliding hour: frees individual slots when oldest sends age out", () => {
    const hour = WARMUP_NONSEED_ALERT_WINDOW_MS;
    const t0 = 1_700_000_000_000;
    const tMid = t0 + 30 * 60 * 1000;
    const tLate = t0 + 45 * 60 * 1000;
    const tAfterFirstAged = t0 + hour + 1;

    let state = refreshSlidingWindowState(
      { individualAlertAtMs: [], summarySent: false, suppressedCount: 0 },
      t0,
      2,
    ).state;
    state = refreshSlidingWindowState(state, t0, 2).state;
    expect(decideNonSeedAlertRate(state, 2).action).toBe("individual");
    state = {
      ...state,
      individualAlertAtMs: [...state.individualAlertAtMs, t0],
    };

    state = refreshSlidingWindowState(state, tMid, 2).state;
    expect(decideNonSeedAlertRate(state, 2).action).toBe("individual");
    state = {
      ...state,
      individualAlertAtMs: [...state.individualAlertAtMs, tMid],
    };

    state = refreshSlidingWindowState(state, tLate, 2).state;
    expect(decideNonSeedAlertRate(state, 2)).toEqual({
      action: "summary",
      eventsSeenInWindow: 3,
    });

    state = {
      ...state,
      summarySent: true,
      suppressedCount: 1,
    };

    const reopened = refreshSlidingWindowState(state, tAfterFirstAged, 2);
    expect(reopened.windowClosed).toEqual({ suppressedCount: 1 });
    expect(reopened.state.individualAlertAtMs).toEqual([tMid]);
    expect(decideNonSeedAlertRate(reopened.state, 2).action).toBe("individual");
  });
});
