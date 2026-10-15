import { describe, expect, it } from "vitest";
import {
  normalizeBrandVariant,
  parseCardVariantForLoad,
} from "@/card-data/normalize-variant";

describe("card variant normalization (unit)", () => {
  it("accepts mono and green at load", () => {
    expect(parseCardVariantForLoad("mono")).toBe("mono");
    expect(parseCardVariantForLoad("green")).toBe("green");
  });

  it("rejects blue at load with a clear message", () => {
    expect(() => parseCardVariantForLoad("blue")).toThrow(/blue.*not storable/i);
  });

  it("rejects unknown variants at load", () => {
    expect(() => parseCardVariantForLoad("purple")).toThrow(/Invalid variant: purple/);
  });

  it("falls back unknown stored values to mono at render", () => {
    expect(normalizeBrandVariant("purple")).toBe("mono");
    expect(normalizeBrandVariant("blue")).toBe("mono");
  });
});
