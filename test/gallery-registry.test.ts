import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("component gallery scaffolding (unit)", () => {
  it("registers the seeded WeMetButton entry", () => {
    const registry = readFileSync("gallery/registry.ts", "utf8");
    expect(registry).toContain("weMetButtonGallery");
  });
});
