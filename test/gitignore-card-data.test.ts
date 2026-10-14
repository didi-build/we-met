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

  it("ignores prepared consumer wrangler configs so real D1 IDs cannot be committed", () => {
    for (const path of [
      "workers/we-met-followup-email-consumer/wrangler.production.ci.jsonc",
      "workers/we-met-followup-email-consumer/wrangler.nonprod.ci.jsonc",
    ]) {
      const result = spawnSync("git", ["check-ignore", "-v", path], {
        encoding: "utf8",
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("wrangler");
      expect(result.stdout).toContain(path);
    }
  });
});
