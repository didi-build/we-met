import { describe, expect, it } from "vitest";
import {
  followupEmailRetryDelaySeconds,
  followupRetryTotalWindowSeconds,
  followupRetryWindowSecondsThroughAttempt,
  MAX_VISITOR_FOLLOWUP_ATTEMPTS,
} from "../scripts/lib/queue-retry-policy.mjs";

describe("queue-retry-policy (unit)", () => {
  it("matches the visitor follow-up delay schedule for the first 8 attempts", () => {
    const expected = [30, 60, 120, 240, 480, 960, 1800, 1800];
    for (let n = 1; n <= expected.length; n++) {
      expect(followupEmailRetryDelaySeconds(n)).toBe(expected[n - 1]);
    }
  });

  it("sums delays through attempt 29 to 43,290 seconds", () => {
    expect(followupRetryWindowSecondsThroughAttempt(29)).toBe(43_290);
    expect(followupRetryTotalWindowSeconds()).toBe(43_290);
  });

  it("keeps total window under the retention budget", () => {
    expect(followupRetryTotalWindowSeconds()).toBeLessThan(72_000);
    expect(MAX_VISITOR_FOLLOWUP_ATTEMPTS).toBe(30);
  });
});
