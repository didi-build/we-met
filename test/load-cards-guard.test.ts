import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { execPath } from "node:process";
import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/load-cards.ts";

function runScript(argv: string[], env: Record<string, string> = {}) {
  return spawnSync(execPath, ["--import", "tsx", SCRIPT, ...argv], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function leftoverGeneratedArtifacts(): string[] {
  const root = readdirSync(".");
  return root
    .filter((name) => name.endsWith(".ci.jsonc") && name.startsWith("wrangler"))
    .concat(root.filter((name) => name.startsWith("load-") && name.endsWith(".sql")));
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

  it("removes generated config and sql when failing after config prepare", () => {
    const result = runScript(["--remote", "--file", "data/cards.example.json"], {
      WE_MET_D1_DATABASE_ID_NONPROD: "11111111-1111-1111-1111-111111111111",
      WE_MET_LOAD_CARDS_TEST_FAIL_AFTER_CONFIG: "1",
    });
    expect(result.status).toBe(1);
    expect(leftoverGeneratedArtifacts()).toEqual([]);
  });

  it("refuses --production without --remote", () => {
    const result = runScript(["--production", "--file", "data/cards.example.json"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--production requires --remote");
  });

  it("exits 1 on wrong production confirmation and leaves no generated files", () => {
    const result = spawnSync(
      execPath,
      [
        "--import",
        "tsx",
        SCRIPT,
        "--remote",
        "--production",
        "--file",
        "data/cards.example.json",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          WE_MET_D1_DATABASE_ID_PRODUCTION: "11111111-1111-1111-1111-111111111111",
          WE_MET_D1_DATABASE_ID_NONPROD: "22222222-2222-2222-2222-222222222222",
        },
        input: "not-production\n",
      },
    );
    expect(result.status).toBe(1);
    expect(leftoverGeneratedArtifacts()).toEqual([]);
  });

  it("exits 1 when --file is missing", () => {
    const result = runScript(["--file"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--file requires");
  });

  it("exits 1 on unknown options", () => {
    const result = runScript(["--nope"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown option");
  });
});
