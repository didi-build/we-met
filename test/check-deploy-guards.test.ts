import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseJsonc } from "../scripts/lib/parse-jsonc.mjs";

const SCRIPT = "scripts/check-deploy-guards.mjs";
const BASE_CONFIG = readFileSync("wrangler.jsonc", "utf8");

function runGuards(
  target: string,
  configPath: string,
  env: Record<string, string> = {},
) {
  return spawnSync("node", [SCRIPT, "--target", target, "--config", configPath], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function writeTempConfig(mutator: (config: Record<string, unknown>) => void) {
  const dir = mkdtempSync(join(tmpdir(), "we-met-guards-"));
  const path = join(dir, "wrangler.jsonc");
  const config = parseJsonc(BASE_CONFIG) as Record<string, unknown>;
  mutator(config);
  writeFileSync(path, JSON.stringify(config, null, 2), "utf8");
  return { dir, path };
}

describe("check-deploy-guards (unit)", () => {
  it("passes preview guards on committed wrangler.jsonc", () => {
    const result = runGuards("preview", "wrangler.jsonc");
    expect(result.status).toBe(0);
  });

  it("passes production guards on committed wrangler.jsonc without GITHUB_ENVIRONMENT", () => {
    const result = runGuards("production", "wrangler.jsonc");
    expect(result.status).toBe(0);
  });

  it("fails when previews block references production queue", () => {
    const { dir, path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const queues = previews.queues as {
        producers: { queue: string }[];
      };
      queues.producers[0].queue = "we-met-followup-email";
    });
    const result = runGuards("preview", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("production resource");
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when WE_MET_ENV=production without GitHub production environment", () => {
    const result = runGuards("production", "wrangler.jsonc", {
      WE_MET_ENV: "production",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("GITHUB_ENVIRONMENT");
  });

  it("passes production guard when GitHub production environment is set", () => {
    const result = runGuards("production", "wrangler.jsonc", {
      WE_MET_ENV: "production",
      GITHUB_ENVIRONMENT: "production",
    });
    expect(result.status).toBe(0);
  });
});
