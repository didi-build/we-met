import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { execPath } from "node:process";
import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/load-cards.ts";

function runScript(argv: string[], env: Record<string, string> = {}) {
  return spawnSync(execPath, ["--import", "tsx", SCRIPT, ...argv], {
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test", ...env },
  });
}

const LOAD_CARDS_CONFIG_ARTIFACTS = [
  "wrangler.d1-nonprod.ci.jsonc",
  "wrangler.load-production.ci.jsonc",
] as const;

function leftoverGeneratedArtifacts(): string[] {
  const found: string[] = [];
  for (const name of LOAD_CARDS_CONFIG_ARTIFACTS) {
    if (existsSync(name)) {
      found.push(name);
    }
  }
  for (const name of readdirSync(".")) {
    if (name.startsWith("load-") && name.endsWith(".sql")) {
      found.push(name);
    }
  }
  return found;
}

describe("load-cards remote guards (unit)", () => {
  it("refuses --remote without WE_MET_D1_DATABASE_ID_NONPROD", () => {
    const result = runScript(["--remote", "--file", "data/cards.example.json"], {
      WE_MET_D1_DATABASE_ID_NONPROD: "",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("WE_MET_D1_DATABASE_ID_NONPROD");
  });

  it("refuses --remote --production", () => {
    const result = runScript(
      ["--remote", "--production", "--file", "data/cards.example.json"],
      {
        WE_MET_D1_DATABASE_ID_NONPROD: "test-nonprod-id",
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no longer supports --production");
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
    expect(result.stderr).toContain("no longer supports --production");
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

  it("validate-only exits 0 on the example file without creating artifacts", () => {
    const result = runScript(["--validate-only", "--file", "data/cards.example.json"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK: 1 cards, 0 hostnames");
    expect(leftoverGeneratedArtifacts()).toEqual([]);
  });

  it("validate-only exits 1 on a broken file", () => {
    const result = runScript(["--validate-only", "--file", "package.json"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid load file");
    expect(leftoverGeneratedArtifacts()).toEqual([]);
  });
});
