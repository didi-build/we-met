import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { parseJsonc } from "../scripts/lib/parse-jsonc.mjs";

const SCRIPT = "scripts/check-deploy-guards.mjs";
const BASE_CONFIG = readFileSync("wrangler.jsonc", "utf8");
const MAIL_SAFETY_BASE = readFileSync("config/nonprod-mail-safety.json", "utf8");

const tempDirs: string[] = [];
const tempMailSpecs: string[] = [];

function runGuards(target: string, configPath: string, extraArgs: string[] = []) {
  return spawnSync(
    "node",
    [SCRIPT, "--target", target, "--config", configPath, ...extraArgs],
    { encoding: "utf8", env: process.env },
  );
}

function writeTempConfig(mutator: (config: Record<string, unknown>) => void) {
  const dir = mkdtempSync(join(tmpdir(), "we-met-guards-"));
  tempDirs.push(dir);
  const path = join(dir, "wrangler.jsonc");
  const config = parseJsonc(BASE_CONFIG) as Record<string, unknown>;
  mutator(config);
  writeFileSync(path, JSON.stringify(config, null, 2), "utf8");
  return { dir, path };
}

function writeTempMailSpec(mutator: (spec: Record<string, unknown>) => void) {
  const dir = mkdtempSync(join(tmpdir(), "we-met-mail-safety-"));
  tempMailSpecs.push(dir);
  const path = join(dir, "nonprod-mail-safety.json");
  const spec = JSON.parse(MAIL_SAFETY_BASE) as Record<string, unknown>;
  mutator(spec);
  writeFileSync(path, JSON.stringify(spec), "utf8");
  return path;
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
  for (const dir of tempMailSpecs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempMailSpecs.length = 0;
});

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
    const { path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const queues = previews.queues as {
        producers: { queue: string }[];
      };
      queues.producers[0].queue = "we-met-followup-email";
    });
    const result = runGuards("preview", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("production resource");
  });

  it("fails when a non-first preview queue is not non-prod", () => {
    const { path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const queues = previews.queues as {
        producers: { queue: string; binding?: string }[];
      };
      queues.producers.push({
        binding: "EXTRA",
        queue: "we-met-other",
      });
    });
    const result = runGuards("preview", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("preview queue");
  });

  it("fails when preview D1 database_name is production", () => {
    const { path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const d1 = previews.d1_databases as { database_name: string }[];
      d1[0].database_name = "we-met-db";
    });
    const result = runGuards("preview", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/preview D1|production resource/);
  });

  it("fails when preview R2 bucket is not non-prod", () => {
    const { path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const r2 = previews.r2_buckets as { bucket_name: string }[];
      r2[0].bucket_name = "we-met-assets-wrong";
    });
    const result = runGuards("preview", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("preview R2 bucket");
  });

  it("fails when preview rate limiter namespace is not non-prod", () => {
    const { path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const rl = previews.ratelimits as { namespace_id: string }[];
      rl[0].namespace_id = "1999";
    });
    const result = runGuards("preview", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("preview rate limiter");
  });

  it("fails when previews.vars.WE_MET_ENV is not preview", () => {
    const { path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const vars = previews.vars as Record<string, string>;
      vars.WE_MET_ENV = "production";
    });
    const result = runGuards("preview", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('previews.vars.WE_MET_ENV must be "preview"');
  });

  it("fails when production Worker name is wrong", () => {
    const { path } = writeTempConfig((config) => {
      config.name = "wrong-worker";
    });
    const result = runGuards("production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("production Worker name");
  });

  it("fails when top-level WE_MET_ENV is not production", () => {
    const { path } = writeTempConfig((config) => {
      const vars = config.vars as Record<string, string>;
      vars.WE_MET_ENV = "preview";
    });
    const result = runGuards("production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('top-level WE_MET_ENV must be "production"');
  });

  it("fails when preview and production D1 database_id match after substitution", () => {
    const { path } = writeTempConfig((config) => {
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
  });

  const wranglerDomainCases = [
    {
      label: "preview_urls not true",
      message: "preview_urls must be true",
      mutate: (config: Record<string, unknown>) => {
        config.preview_urls = false;
      },
    },
    {
      label: "workers_dev not false",
      message: "workers_dev must be false",
      mutate: (config: Record<string, unknown>) => {
        config.workers_dev = true;
      },
    },
  ] as const;

  for (const target of ["preview", "production"] as const) {
    for (const { label, message, mutate } of wranglerDomainCases) {
      it(`fails ${target} guards when ${label}`, () => {
        const { path } = writeTempConfig(mutate);
        const result = runGuards(target, path);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(message);
      });
    }
  }

  const productionMissingBindingCases = [
    {
      label: "d1_databases",
      message: "production d1_databases is required",
      mutate: (config: Record<string, unknown>) => {
        config.d1_databases = [];
      },
    },
    {
      label: "r2_buckets",
      message: "production r2_buckets is required",
      mutate: (config: Record<string, unknown>) => {
        config.r2_buckets = [];
      },
    },
    {
      label: "queues.producers",
      message: "production queues.producers is required",
      mutate: (config: Record<string, unknown>) => {
        (config.queues as { producers: unknown[] }).producers = [];
      },
    },
    {
      label: "ratelimits",
      message: "production ratelimits is required",
      mutate: (config: Record<string, unknown>) => {
        config.ratelimits = [];
      },
    },
  ] as const;

  for (const { label, message, mutate } of productionMissingBindingCases) {
    it(`fails when production ${label} is empty`, () => {
      const { path } = writeTempConfig(mutate);
      const result = runGuards("production", path);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(message);
    });
  }

  it("fails when mail-safety config is invalid JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "we-met-mail-safety-"));
    tempMailSpecs.push(dir);
    const path = join(dir, "bad.json");
    writeFileSync(path, "{not-json", "utf8");
    const result = runGuards("preview", "wrangler.jsonc", [
      "--mail-safety-config",
      path,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("missing or invalid");
  });

  it("fails when nonprod mail safety failClosedIfUnset is false", () => {
    const path = writeTempMailSpec((spec) => {
      spec.failClosedIfUnset = false;
    });
    const result = runGuards("preview", "wrangler.jsonc", [
      "--mail-safety-config",
      path,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("fail closed");
  });
});
