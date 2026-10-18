import { describe, expect, it } from "vitest";
import { emailProviderFromSettingValue } from "@/app-settings/defaults";

describe("emailProviderFromSettingValue (unit)", () => {
  it("defaults to gmail when missing or unknown", () => {
    expect(emailProviderFromSettingValue(undefined)).toBe("gmail");
    expect(emailProviderFromSettingValue("")).toBe("gmail");
    expect(emailProviderFromSettingValue("smtp")).toBe("gmail");
  });

  it("selects cloudflare when configured", () => {
    expect(emailProviderFromSettingValue("cloudflare")).toBe("cloudflare");
    expect(emailProviderFromSettingValue(" Cloudflare ")).toBe("cloudflare");
  });
});
