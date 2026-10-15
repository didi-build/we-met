import { describe, expect, it } from "vitest";
import {
  normalizeBrandVariant,
  parseCardVariantForLoad,
} from "@/card-data/normalize-variant";

describe("card variant normalization (unit)", () => {
  it("accepts mono at load", () => {
    expect(parseCardVariantForLoad("mono")).toBe("mono");
  });

  it("rejects green at load with a clear message", () => {
    expect(() => parseCardVariantForLoad("green")).toThrow(/mono only/i);
  });

  it("rejects unknown variants at load", () => {
    expect(() => parseCardVariantForLoad("purple")).toThrow(/Invalid variant: purple/);
  });

  it("always renders mono from stored values", () => {
    expect(normalizeBrandVariant("purple")).toBe("mono");
    expect(normalizeBrandVariant("green")).toBe("mono");
  });
});
