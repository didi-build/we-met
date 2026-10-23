import { describe, expect, it } from "vitest";
import {
  leadEmailEnabledFromSettingValue,
  signupsOpenFromSettingValue,
  visitorEmailModeFromSettingValue,
} from "@/app-settings/defaults";

describe("app_settings defaults (unit)", () => {
  it("treats missing signups_open as closed", () => {
    expect(signupsOpenFromSettingValue(undefined)).toBe(false);
    expect(signupsOpenFromSettingValue(null)).toBe(false);
    expect(signupsOpenFromSettingValue("")).toBe(false);
    expect(signupsOpenFromSettingValue("0")).toBe(false);
    expect(signupsOpenFromSettingValue("1")).toBe(true);
  });

  it("defaults lead_email_enabled to enabled when missing", () => {
    expect(leadEmailEnabledFromSettingValue(undefined)).toBe(true);
    expect(leadEmailEnabledFromSettingValue(null)).toBe(true);
    expect(leadEmailEnabledFromSettingValue("")).toBe(true);
    expect(leadEmailEnabledFromSettingValue("0")).toBe(false);
    expect(leadEmailEnabledFromSettingValue("1")).toBe(true);
  });

  it("defaults visitor_email_mode to owner_relay unless direct", () => {
    expect(visitorEmailModeFromSettingValue(undefined)).toBe("owner_relay");
    expect(visitorEmailModeFromSettingValue(null)).toBe("owner_relay");
    expect(visitorEmailModeFromSettingValue("")).toBe("owner_relay");
    expect(visitorEmailModeFromSettingValue("unknown")).toBe("owner_relay");
    expect(visitorEmailModeFromSettingValue("OWNER_RELAY")).toBe("owner_relay");
    expect(visitorEmailModeFromSettingValue("Direct")).toBe("owner_relay");
    expect(visitorEmailModeFromSettingValue("DIRECT")).toBe("owner_relay");
    expect(visitorEmailModeFromSettingValue("direct")).toBe("direct");
  });
});
