import { describe, expect, it } from "vitest";
import {
  expectedMonthlySendsFromProbability,
  shouldSendThisTick,
  WARMUP_SEND_PROBABILITY_BOUNDS,
  WARMUP_SEND_PROBABILITY_PER_TICK,
  WARMUP_TARGET_SENDS_PER_MONTH,
} from "../../workers/warmup/lib/rate";

describe("warmup send rate (unit)", () => {
  it("keeps monthly target probability within QA bounds", () => {
    expect(WARMUP_SEND_PROBABILITY_PER_TICK).toBeGreaterThanOrEqual(
      WARMUP_SEND_PROBABILITY_BOUNDS.min,
    );
    expect(WARMUP_SEND_PROBABILITY_PER_TICK).toBeLessThanOrEqual(
      WARMUP_SEND_PROBABILITY_BOUNDS.max,
    );
  });

  it("expects about 200 sends per month at the configured probability", () => {
    const expected = expectedMonthlySendsFromProbability(
      WARMUP_SEND_PROBABILITY_PER_TICK,
    );
    expect(expected).toBeCloseTo(WARMUP_TARGET_SENDS_PER_MONTH, 0);
  });

  it("shouldSendThisTick respects the threshold", () => {
    expect(shouldSendThisTick(0)).toBe(true);
    expect(shouldSendThisTick(WARMUP_SEND_PROBABILITY_PER_TICK - 0.0001)).toBe(true);
    expect(shouldSendThisTick(WARMUP_SEND_PROBABILITY_PER_TICK)).toBe(false);
  });
});
