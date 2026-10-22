import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("check-warmup-no-emails script (unit)", () => {
  it("passes on the committed workers/warmup tree", () => {
    const result = spawnSync("node", ["scripts/check-warmup-no-emails.mjs"], {
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ok");
  });
});
