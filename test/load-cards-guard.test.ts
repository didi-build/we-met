import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/load-cards.ts";

function runScript(argv: string[], env: Record<string, string> = {}) {
  return spawnSync("npx", ["tsx", SCRIPT, ...argv], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("load-cards remote guards (unit)", () => {
  it("refuses --remote without WE_MET_D1_DATABASE_ID_NONPROD", () => {
    const result = runScript(["--remote", "--file", "data/cards.example.json"], {
      WE_MET_D1_DATABASE_ID_NONPROD: "",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("WE_MET_D1_DATABASE_ID_NONPROD");
  });

  it("refuses --remote --production without production D1 id", () => {
    const result = runScript(
      ["--remote", "--production", "--file", "data/cards.example.json"],
      {
        WE_MET_D1_DATABASE_ID_PRODUCTION: "",
        WE_MET_D1_DATABASE_ID_NONPROD: "test-nonprod-id",
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("WE_MET_D1_DATABASE_ID_PRODUCTION");
  });
});
