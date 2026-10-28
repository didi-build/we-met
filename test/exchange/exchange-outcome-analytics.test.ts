import { describe, expect, it, vi } from "vitest";
import {
  exchangeOutcomeClassForLeadEmailDenial,
  writeExchangeOutcomeDataPoint,
} from "@/exchange/exchange-outcome-analytics";

describe("writeExchangeOutcomeDataPoint (unit)", () => {
  it("writes index exchange_outcome, blob status class, and counter double", () => {
    const writeDataPoint = vi.fn();
    writeExchangeOutcomeDataPoint(
      {
        WE_MET_EXCHANGE_OUTCOME_ANALYTICS: { writeDataPoint },
      } as unknown as CloudflareEnv,
      "429",
    );
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["exchange_outcome"],
      blobs: ["429"],
      doubles: [1],
    });
  });

  it("no-ops when the Analytics Engine binding is absent", () => {
    expect(() =>
      writeExchangeOutcomeDataPoint({} as CloudflareEnv, "2xx"),
    ).not.toThrow();
  });

  it("does not throw when writeDataPoint throws", () => {
    const writeDataPoint = vi.fn(() => {
      throw new Error("analytics unavailable");
    });
    expect(() =>
      writeExchangeOutcomeDataPoint(
        {
          WE_MET_EXCHANGE_OUTCOME_ANALYTICS: { writeDataPoint },
        } as unknown as CloudflareEnv,
        "5xx",
      ),
    ).not.toThrow();
  });
});

describe("exchangeOutcomeClassForLeadEmailDenial (unit)", () => {
  it("maps kill switch, cap reached, and cap config errors", () => {
    expect(exchangeOutcomeClassForLeadEmailDenial("kill_switch")).toBe(
      "kill-switch 503",
    );
    expect(exchangeOutcomeClassForLeadEmailDenial("cap_reached")).toBe("cap_reached");
    expect(exchangeOutcomeClassForLeadEmailDenial("cap_config_error")).toBe(
      "cap_config_error",
    );
  });
});
