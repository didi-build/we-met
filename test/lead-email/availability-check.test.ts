import { describe, expect, it } from "vitest";
import { exchangeOutcomeClassForLeadEmailDenial } from "@/exchange/exchange-outcome-analytics";
import { checkLeadEmailCapacity } from "@/lead-email/availability";

describe("checkLeadEmailCapacity (unit)", () => {
  const baseControls = {
    leadEmailEnabled: true,
    visitorEmailMode: "direct" as const,
    dailyCapGlobal: 150,
    dailyCapPerCard: 50,
  };

  it("returns kill_switch when lead email is disabled", () => {
    expect(
      checkLeadEmailCapacity(
        { ...baseControls, leadEmailEnabled: false },
        { globalUsed: 0, cardUsed: 0 },
        2,
      ),
    ).toEqual({ allowed: false, reason: "kill_switch" });
  });

  it("returns cap_config_error when cap settings are invalid", () => {
    expect(
      checkLeadEmailCapacity(
        { ...baseControls, dailyCapGlobal: null },
        { globalUsed: 0, cardUsed: 0 },
        2,
      ),
    ).toEqual({ allowed: false, reason: "cap_config_error" });
  });

  it("returns cap_reached when usage would exceed caps", () => {
    expect(
      checkLeadEmailCapacity(baseControls, { globalUsed: 149, cardUsed: 0 }, 2),
    ).toEqual({ allowed: false, reason: "cap_reached" });
  });
});

describe("exchangeOutcomeClassForLeadEmailDenial (unit)", () => {
  it("maps denial reasons to Analytics Engine status classes", () => {
    expect(exchangeOutcomeClassForLeadEmailDenial("kill_switch")).toBe(
      "kill-switch 503",
    );
    expect(exchangeOutcomeClassForLeadEmailDenial("cap_reached")).toBe("cap_reached");
    expect(exchangeOutcomeClassForLeadEmailDenial("cap_config_error")).toBe(
      "cap_config_error",
    );
  });
});
