import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/apply-migrations.mjs";
const PRODUCTION_DATABASE_ID = "00000000-0000-0000-0000-000000000001";

function runScript(argv: string[]) {
  return spawnSync("node", [SCRIPT, ...argv], { encoding: "utf8" });
}

describe("apply-migrations remote allowlist (unit)", () => {
  it("rejects --remote with no database name", () => {
    const result = runScript(["--remote"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("allowlisted");
    expect(result.stderr).toContain("we-met-db-nonprod");
  });

  it("rejects --remote we-met-db", () => {
    const result = runScript(["--remote", "we-met-db"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing target "we-met-db"');
  });

  it("rejects --remote WE_MET_DB binding name", () => {
    const result = runScript(["--remote", "WE_MET_DB"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing target "WE_MET_DB"');
  });

  it("rejects --remote production database ID placeholder", () => {
    const result = runScript(["--remote", PRODUCTION_DATABASE_ID]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Refusing target "${PRODUCTION_DATABASE_ID}"`);
  });

  it("rejects --config", () => {
    const result = runScript([
      "--remote",
      "we-met-db-nonprod",
      "--config",
      "evil.jsonc",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--config is not supported");
  });

  it("rejects --remote with an unknown database name", () => {
    const result = runScript(["--remote", "some-other-db"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing target "some-other-db"');
  });
});
