import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("component gallery scaffolding (unit)", () => {
  it("registers the seeded Button entry from src/", () => {
    const registry = readFileSync("gallery/registry.ts", "utf8");
    expect(registry).toContain("uiButtonGallery");
  });
});
