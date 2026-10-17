import { describe, expect, it } from "vitest";
import { FollowupEmailError } from "@/email/followup-email-error";
import {
  resolveFromDisplayName,
  resolveVisitorFromDisplayName,
} from "@/email/from-display-name";
import { formatEmailFromHeader } from "@/email/mime-headers";

const PLATFORM = "Diadem at We Met";

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

describe("resolveVisitorFromDisplayName (unit)", () => {
  it("uses first word with via We Met suffix for a normal name", () => {
    expect(resolveVisitorFromDisplayName("Diadem", PLATFORM)).toBe("Diadem via We Met");
    expect(resolveVisitorFromDisplayName("Diadem Marie", PLATFORM)).toBe(
      "Diadem via We Met",
    );
  });

  it("supports non-ASCII first names and produces a valid From header", () => {
    const displayName = resolveVisitorFromDisplayName("Zoë", PLATFORM);
    expect(displayName).toBe("Zoë via We Met");
    const header = formatEmailFromHeader("hello@we-met.link", displayName);
    expect(header).toMatch(/^=\?UTF-8\?B\?/);
    expect(header).not.toMatch(/^"=\?UTF-8\?B\?/);
    expect(header).toContain("<hello@we-met.link>");
  });

  it("falls back to the platform name when the first name fails validation", () => {
    const fallbacks = [
      "",
      "   ",
      "a".repeat(25),
      "R2D2",
      "evil@name",
      "dot.name",
      "slash/name",
      "Name\r\nInject",
      "Evil<",
      "ADMIN",
      "No-Reply",
      "wemet",
      "Google",
    ];
    for (const given of fallbacks) {
      expect(resolveVisitorFromDisplayName(given, PLATFORM)).toBe(PLATFORM);
    }
  });

  it("allows hyphen and apostrophe in the first name", () => {
    expect(resolveVisitorFromDisplayName("Mary-Jane", PLATFORM)).toBe(
      "Mary-Jane via We Met",
    );
    expect(resolveVisitorFromDisplayName("Alex O'Neill", PLATFORM)).toBe(
      "Alex via We Met",
    );
  });
});
