import { describe, expect, it } from "vitest";
import { isReservedSlug } from "@/card-data/reserved-slugs";

describe("reserved slugs (unit)", () => {
  it("blocks impersonation slugs but not didi", () => {
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("we-met")).toBe(true);
    expect(isReservedSlug("didi")).toBe(false);
  });
});
