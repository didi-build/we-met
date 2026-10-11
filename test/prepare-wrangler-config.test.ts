import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  D1_PLACEHOLDER_NONPROD,
  D1_PLACEHOLDER_PRODUCTION,
} from "../scripts/lib/wrangler-placeholders.mjs";

const SCRIPT = "scripts/prepare-wrangler-config.mjs";

function runPrepare(target: string, output: string, env: Record<string, string>) {
  return spawnSync("node", [SCRIPT, "--target", target, "--output", output], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function uniqueRootOutput(basename: string) {
  return resolve(`wrangler.ci.test-${basename}-${process.pid}.jsonc`);
}

describe("prepare-wrangler-config (unit)", () => {
  it("substitutes both D1 IDs for production target", () => {
    const output = uniqueRootOutput("production");
    const result = runPrepare("production", output, {
      WE_MET_D1_DATABASE_ID_PRODUCTION: "11111111-1111-1111-1111-111111111111",
      WE_MET_D1_DATABASE_ID_NONPROD: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.status).toBe(0);
    const text = readFileSync(output, "utf8");
    expect(text).toContain("11111111-1111-1111-1111-111111111111");
    expect(text).toContain("22222222-2222-2222-2222-222222222222");
    expect(text).not.toContain(D1_PLACEHOLDER_PRODUCTION);
    expect(text).not.toContain(D1_PLACEHOLDER_NONPROD);
    rmSync(output, { force: true });
  });

  it("fails production target when a placeholder env var is missing", () => {
    const output = uniqueRootOutput("production-missing");
    const result = runPrepare("production", output, {
      WE_MET_D1_DATABASE_ID_PRODUCTION: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.status).toBe(1);
    rmSync(output, { force: true });
  });

  it("fails when --output is not a file in the repository root", () => {
    const output = join(tmpdir(), "wrangler-outside-root.jsonc");
    const result = runPrepare("production", output, {
      WE_MET_D1_DATABASE_ID_PRODUCTION: "11111111-1111-1111-1111-111111111111",
      WE_MET_D1_DATABASE_ID_NONPROD: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("repository root");
    expect(result.stderr).toContain("config file directory");
  });

  it("writes minimal nonprod config with migrations_dir resolving to migrations/", () => {
    const output = resolve(`wrangler.d1-nonprod.ci.test-${process.pid}.jsonc`);
    const result = runPrepare("d1-migrate-nonprod", output, {
      WE_MET_D1_DATABASE_ID_NONPROD: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(readFileSync(output, "utf8")) as {
      migrations_dir: string;
      d1_databases: { migrations_dir: string }[];
    };
    const migrationsDir =
      parsed.d1_databases[0].migrations_dir ?? parsed.migrations_dir;
    const resolvedMigrations = resolve(dirname(output), migrationsDir);
    expect(existsSync(resolvedMigrations)).toBe(true);
    rmSync(output, { force: true });
  });
});
