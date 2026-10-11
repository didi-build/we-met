import { describe, expect, it } from "vitest";
import { isValidSlug } from "@/card-data/slug";

describe("slug validation (unit)", () => {
  it("accepts valid slugs", () => {
    expect(isValidSlug("didi")).toBe(true);
    expect(isValidSlug("a")).toBe(true);
    expect(isValidSlug("demo-user-2")).toBe(true);
  });

  it("rejects invalid slugs", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("-didi")).toBe(false);
    expect(isValidSlug("didi-")).toBe(false);
    expect(isValidSlug("Didi")).toBe(false);
    expect(isValidSlug("didi_build")).toBe(false);
    expect(isValidSlug("a".repeat(49))).toBe(false);
  });
});
