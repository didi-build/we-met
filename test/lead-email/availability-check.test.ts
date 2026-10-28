import { describe, expect, it } from "vitest";
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

  it("allows exchange at exact global and per-card cap boundaries", () => {
    expect(
      checkLeadEmailCapacity(baseControls, { globalUsed: 148, cardUsed: 0 }, 2),
    ).toEqual({ allowed: true });
    expect(
      checkLeadEmailCapacity(baseControls, { globalUsed: 149, cardUsed: 0 }, 1),
    ).toEqual({ allowed: true });
    expect(
      checkLeadEmailCapacity(baseControls, { globalUsed: 0, cardUsed: 48 }, 2),
    ).toEqual({ allowed: true });
    expect(
      checkLeadEmailCapacity(baseControls, { globalUsed: 0, cardUsed: 49 }, 1),
    ).toEqual({ allowed: true });
  });

  it("returns cap_reached when usage would exceed caps", () => {
    expect(
      checkLeadEmailCapacity(baseControls, { globalUsed: 149, cardUsed: 0 }, 2),
    ).toEqual({ allowed: false, reason: "cap_reached" });
    expect(
      checkLeadEmailCapacity(baseControls, { globalUsed: 0, cardUsed: 49 }, 2),
    ).toEqual({ allowed: false, reason: "cap_reached" });
  });
});
