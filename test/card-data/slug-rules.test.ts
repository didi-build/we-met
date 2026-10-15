import { describe, expect, it } from "vitest";
import { CARD_FIELD_LIMITS } from "@/card-data/limits";
import { isValidSlug } from "@/card-data/slug";

describe("slug rules (unit)", () => {
  it("enforces length and hyphen rules from CARD_FIELD_LIMITS", () => {
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("abc")).toBe(true);
    expect(isValidSlug("a".repeat(CARD_FIELD_LIMITS.slugMax))).toBe(true);
    expect(isValidSlug("a".repeat(CARD_FIELD_LIMITS.slugMax + 1))).toBe(false);
    expect(isValidSlug("a--b")).toBe(false);
    expect(isValidSlug("-abc")).toBe(false);
    expect(isValidSlug("abc-")).toBe(false);
  });
});
