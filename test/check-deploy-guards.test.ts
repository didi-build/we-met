import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseJsonc } from "../scripts/lib/parse-jsonc.mjs";

const SCRIPT = "scripts/check-deploy-guards.mjs";
const BASE_CONFIG = readFileSync("wrangler.jsonc", "utf8");
const MAIL_SAFETY_PATH = "config/nonprod-mail-safety.json";
const MAIL_SAFETY_BASE = readFileSync(MAIL_SAFETY_PATH, "utf8");

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

function withMailSafety(mutator: () => void) {
  const backup = MAIL_SAFETY_BASE;
  try {
    mutator();
    return runGuards("preview", "wrangler.jsonc");
  } finally {
    writeFileSync(MAIL_SAFETY_PATH, backup, "utf8");
  }
}

describe("check-deploy-guards (unit)", () => {
  it("passes preview guards on committed wrangler.jsonc", () => {
    const result = runGuards("preview", "wrangler.jsonc");
    expect(result.status).toBe(0);
  });

  it("passes production guards on committed wrangler.jsonc", () => {
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

  it("fails when a non-first preview queue references production", () => {
    const { dir, path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const queues = previews.queues as {
        producers: { queue: string }[];
      };
      queues.producers.push({
        binding: "EXTRA",
        queue: "we-met-followup-email",
      } as (typeof queues.producers)[number]);
    });
    const result = runGuards("preview", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("production resource");
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when preview D1 database_name is production", () => {
    const { dir, path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const d1 = previews.d1_databases as { database_name: string }[];
      d1[0].database_name = "we-met-db";
    });
    const result = runGuards("preview", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/preview D1|production resource/);
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when preview R2 bucket is not non-prod", () => {
    const { dir, path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const r2 = previews.r2_buckets as { bucket_name: string }[];
      r2[0].bucket_name = "we-met-assets-wrong";
    });
    const result = runGuards("preview", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("preview R2 bucket");
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when preview rate limiter namespace is not non-prod", () => {
    const { dir, path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const rl = previews.ratelimits as { namespace_id: string }[];
      rl[0].namespace_id = "1999";
    });
    const result = runGuards("preview", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("preview rate limiter");
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when previews.vars.WE_MET_ENV is not preview", () => {
    const { dir, path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const vars = previews.vars as Record<string, string>;
      vars.WE_MET_ENV = "production";
    });
    const result = runGuards("preview", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('previews.vars.WE_MET_ENV must be "preview"');
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when production Worker name is wrong", () => {
    const { dir, path } = writeTempConfig((config) => {
      config.name = "wrong-worker";
    });
    const result = runGuards("production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("production Worker name");
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when top-level WE_MET_ENV is not production", () => {
    const { dir, path } = writeTempConfig((config) => {
      const vars = config.vars as Record<string, string>;
      vars.WE_MET_ENV = "preview";
    });
    const result = runGuards("production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('top-level WE_MET_ENV must be "production"');
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when preview and production D1 database_id match after substitution", () => {
    const { dir, path } = writeTempConfig((config) => {
      const same = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
      const d1 = config.d1_databases as { database_id: string }[];
      const previews = config.previews as Record<string, unknown>;
      const previewD1 = previews.d1_databases as { database_id: string }[];
      d1[0].database_id = same;
      previewD1[0].database_id = same;
    });
    const result = runGuards("preview", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("database_id");
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when nonprod-mail-safety.json is invalid JSON", () => {
    writeFileSync(MAIL_SAFETY_PATH, "{not-json", "utf8");
    const result = withMailSafety(() => {});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("nonprod-mail-safety");
  });

  it("fails when nonprod mail safety failClosedIfUnset is false", () => {
    const result = withMailSafety(() => {
      const spec = JSON.parse(MAIL_SAFETY_BASE) as Record<string, unknown>;
      spec.failClosedIfUnset = false;
      writeFileSync(MAIL_SAFETY_PATH, JSON.stringify(spec), "utf8");
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("fail closed");
  });
});
