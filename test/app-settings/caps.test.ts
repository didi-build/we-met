import { describe, expect, it } from "vitest";
import { leadEmailSubmissionAllowed, parsePositiveCapValue } from "@/app-settings/caps";
import { leadEmailEnabledFromSettingValue } from "@/app-settings/defaults";

describe("lead email caps (unit)", () => {
  it("parses positive integer caps only", () => {
    expect(parsePositiveCapValue("100")).toBe(100);
    expect(parsePositiveCapValue("1")).toBe(1);
  });

  it.each(["0", "", "-5", "100abc", "1e3", "12.5", "abc"])(
    "rejects invalid cap string %s",
    (value) => {
      expect(parsePositiveCapValue(value)).toBeNull();
    },
  );

  it("rejects null and undefined cap values", () => {
    expect(parsePositiveCapValue(null)).toBeNull();
    expect(parsePositiveCapValue(undefined)).toBeNull();
  });

  it("defaults missing lead_email_enabled to enabled", () => {
    expect(leadEmailEnabledFromSettingValue(undefined)).toBe(true);
    expect(leadEmailEnabledFromSettingValue("")).toBe(true);
  });

  it("fails closed when caps are missing or invalid", () => {
    const controls = {
      leadEmailEnabled: true,
      emailProvider: "gmail" as const,
      dailyCapGlobal: null,
      dailyCapPerCard: 100,
    };
    expect(
      leadEmailSubmissionAllowed(controls, { globalUsed: 0, cardUsed: 0 }, 1),
    ).toBe(false);
  });

  it("rejects when switch is off without revealing which limit", () => {
    const controls = {
      leadEmailEnabled: false,
      emailProvider: "gmail" as const,
      dailyCapGlobal: 500,
      dailyCapPerCard: 100,
    };
    expect(
      leadEmailSubmissionAllowed(controls, { globalUsed: 0, cardUsed: 0 }, 2),
    ).toBe(false);
  });

  it("exchange needs two slots; details needs one", () => {
    const controls = {
      leadEmailEnabled: true,
      emailProvider: "gmail" as const,
      dailyCapGlobal: 500,
      dailyCapPerCard: 10,
    };
    const usage = { globalUsed: 0, cardUsed: 9 };
    expect(leadEmailSubmissionAllowed(controls, usage, 2)).toBe(false);
    expect(leadEmailSubmissionAllowed(controls, usage, 1)).toBe(true);
  });
});
