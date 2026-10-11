import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("prepare-wrangler-config (unit)", () => {
  it("substitutes both D1 IDs for production target", () => {
    const dir = mkdtempSync(join(tmpdir(), "we-met-wrangler-"));
    const output = join(dir, "wrangler.jsonc");
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
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails production target when a placeholder env var is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "we-met-wrangler-"));
    const output = join(dir, "wrangler.jsonc");
    const result = runPrepare("production", output, {
      WE_MET_D1_DATABASE_ID_PRODUCTION: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.status).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes minimal nonprod config for d1-migrate-nonprod", () => {
    const dir = mkdtempSync(join(tmpdir(), "we-met-wrangler-"));
    const output = join(dir, "wrangler-d1.jsonc");
    const result = runPrepare("d1-migrate-nonprod", output, {
      WE_MET_D1_DATABASE_ID_NONPROD: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(readFileSync(output, "utf8")) as {
      d1_databases: { database_name: string; database_id: string }[];
    };
    expect(parsed.d1_databases[0].database_name).toBe("we-met-db-nonprod");
    expect(parsed.d1_databases[0].database_id).toBe(
      "22222222-2222-2222-2222-222222222222",
    );
    rmSync(dir, { recursive: true, force: true });
  });
});
