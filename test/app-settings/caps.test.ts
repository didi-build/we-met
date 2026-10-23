import { describe, expect, it } from "vitest";
import {
  leadEmailSubmissionAllowed,
  parsePositiveCapValue,
  readLeadEmailControls,
} from "@/app-settings/caps";
import { leadEmailEnabledFromSettingValue } from "@/app-settings/defaults";
import type { D1Database } from "@cloudflare/workers-types";

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
      visitorEmailMode: "direct" as const,
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
      visitorEmailMode: "direct" as const,
      dailyCapGlobal: 500,
      dailyCapPerCard: 100,
    };
    expect(
      leadEmailSubmissionAllowed(controls, { globalUsed: 0, cardUsed: 0 }, 2),
    ).toBe(false);
  });

  it("direct exchange needs two slots; owner_relay exchange needs one", () => {
    const controls = {
      leadEmailEnabled: true,
      visitorEmailMode: "direct" as const,
      dailyCapGlobal: 500,
      dailyCapPerCard: 10,
    };
    const usage = { globalUsed: 0, cardUsed: 9 };
    expect(leadEmailSubmissionAllowed(controls, usage, 2)).toBe(false);
    expect(leadEmailSubmissionAllowed(controls, usage, 1)).toBe(true);
  });

  it("readLeadEmailControls ignores legacy email_provider rows", async () => {
    const settings: Record<string, string> = {
      lead_email_enabled: "1",
      email_provider: "gmail",
      visitor_email_mode: "direct",
      daily_cap_global: "150",
      daily_cap_per_card: "50",
    };
    const db = {
      prepare: () => ({
        bind: (...keys: string[]) => ({
          all: async () => ({
            results: keys
              .filter((key) => key in settings)
              .map((key) => ({ key, value: settings[key] })),
          }),
        }),
      }),
    } as unknown as D1Database;

    const controls = await readLeadEmailControls(db);
    expect(controls).toEqual({
      leadEmailEnabled: true,
      visitorEmailMode: "direct",
      dailyCapGlobal: 150,
      dailyCapPerCard: 50,
    });
    expect(controls).not.toHaveProperty("emailProvider");
  });
});
