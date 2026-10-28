import { describe, expect, it, vi } from "vitest";
import {
  exchangeOutcomeStatusClassFromHttp,
  recordExchangeOutcomeFromResponse,
  writeExchangeOutcomeDataPoint,
} from "@/exchange/exchange-outcome-analytics";

describe("exchangeOutcomeStatusClassFromHttp (unit)", () => {
  it("maps HTTP outcomes to the five status classes", () => {
    expect(exchangeOutcomeStatusClassFromHttp(200)).toBe("2xx");
    expect(exchangeOutcomeStatusClassFromHttp(400)).toBe("4xx");
    expect(exchangeOutcomeStatusClassFromHttp(403)).toBe("4xx");
    expect(exchangeOutcomeStatusClassFromHttp(404)).toBe("4xx");
    expect(exchangeOutcomeStatusClassFromHttp(429)).toBe("429");
    expect(exchangeOutcomeStatusClassFromHttp(500)).toBe("5xx");
    expect(exchangeOutcomeStatusClassFromHttp(503)).toBe("5xx");
    expect(exchangeOutcomeStatusClassFromHttp(503, "lead_email_unavailable")).toBe(
      "kill-switch 503",
    );
  });
});

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

describe("recordExchangeOutcomeFromResponse (unit)", () => {
  it("classifies kill-switch 503 from JSON error body", async () => {
    const writeDataPoint = vi.fn();
    const response = Response.json(
      { error: "lead_email_unavailable" },
      { status: 503 },
    );
    await recordExchangeOutcomeFromResponse(
      {
        WE_MET_EXCHANGE_OUTCOME_ANALYTICS: { writeDataPoint },
      } as unknown as CloudflareEnv,
      response,
    );
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["exchange_outcome"],
      blobs: ["kill-switch 503"],
      doubles: [1],
    });
  });
});
