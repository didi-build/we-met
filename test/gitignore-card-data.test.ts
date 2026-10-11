import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("gitignore card data (unit)", () => {
  it("ignores data/cards.local.json so real card JSON cannot be committed", () => {
    const result = spawnSync("git", ["check-ignore", "data/cards.local.json"], {
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toContain("data/cards.local.json");
  });
});
