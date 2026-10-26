import { describe, expect, it } from "vitest";
import {
  formatNonProductionBannerText,
  resolveNonProductionBanner,
  resolveNonProductionBannerLabel,
  shouldSendNonProductionXRobotsTag,
  shortCommitSha,
} from "@/lib/we-met/non-production";

describe("non-production env helpers (unit)", () => {
  it("sends X-Robots-Tag for staging and preview but not production", () => {
    expect(shouldSendNonProductionXRobotsTag("staging")).toBe(true);
    expect(shouldSendNonProductionXRobotsTag("preview")).toBe(true);
    expect(shouldSendNonProductionXRobotsTag("local")).toBe(true);
    expect(shouldSendNonProductionXRobotsTag("production")).toBe(false);
    expect(shouldSendNonProductionXRobotsTag(undefined)).toBe(false);
  });

  it("maps public env values to banner labels", () => {
    expect(resolveNonProductionBannerLabel("staging")).toBe("Staging");
    expect(resolveNonProductionBannerLabel("preview")).toBe("Preview");
    expect(resolveNonProductionBannerLabel("local")).toBe("Local");
    expect(resolveNonProductionBannerLabel("production")).toBeNull();
  });

  it("formats banner text with an optional short commit SHA", () => {
    expect(
      formatNonProductionBannerText({
        label: "Staging",
        shortSha: "abc1234",
      }),
    ).toBe("Staging abc1234");
    expect(shortCommitSha("deadbeef")).toBe("deadbee");
    expect(
      formatNonProductionBannerText({
        label: "Preview",
        shortSha: "",
      }),
    ).toBe("Preview");
    expect(resolveNonProductionBanner("staging", "abcdef0123456789")?.shortSha).toBe(
      "abcdef0",
    );
    expect(shortCommitSha("  ")).toBe("");
  });
});
