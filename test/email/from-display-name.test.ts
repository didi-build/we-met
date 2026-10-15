import { describe, expect, it } from "vitest";
import { FollowupEmailError } from "@/email/followup-email-error";
import { resolveFromDisplayName } from "@/email/from-display-name";

describe("resolveFromDisplayName (unit)", () => {
  it("returns trimmed value when valid", () => {
    expect(resolveFromDisplayName("  Diadem at We Met  ")).toBe("Diadem at We Met");
  });

  it("accepts up to 80 characters", () => {
    const value = "a".repeat(80);
    expect(resolveFromDisplayName(value)).toBe(value);
  });

  it("fails closed when unset, empty, whitespace-only, too long, or invalid", () => {
    const over80 = "a".repeat(81);
    for (const value of [
      undefined,
      "",
      "  ",
      over80,
      "Name\r\nInject",
      "Name\nInject",
      'Evil"',
      "Evil<",
      "Evil>",
      "Evil\\",
      "Evil\x00Name",
    ]) {
      expect(() => resolveFromDisplayName(value)).toThrow(FollowupEmailError);
      try {
        resolveFromDisplayName(value);
      } catch (error) {
        expect(error).toMatchObject({
          code: "from_display_name_missing",
          secretName: "WE_MET_FROM_DISPLAY_NAME",
        });
      }
    }
  });
});
