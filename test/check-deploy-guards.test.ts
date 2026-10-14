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

  it("passes production guards on production-prepared config with nonprod placeholder left in", () => {
    const configPath = `wrangler.guards-test-${process.pid}.ci.jsonc`;
    const prep = spawnSync(
      "node",
      [
        "scripts/prepare-wrangler-config.mjs",
        "--target",
        "production",
        "--output",
        configPath,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          WE_MET_D1_DATABASE_ID_PRODUCTION: "11111111-1111-1111-1111-111111111111",
        },
      },
    );
    expect(prep.status).toBe(0);
    try {
      const result = runGuards("production", configPath);
      expect(result.status).toBe(0);
    } finally {
      rmSync(configPath, { force: true });
    }
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

  const previewHostSuffixCases = [
    {
      label: "previews.vars.WE_MET_PREVIEW_HOST_SUFFIX is empty",
      message: "previews.vars.WE_MET_PREVIEW_HOST_SUFFIX must be non-empty",
      mutate: (config: Record<string, unknown>) => {
        const previews = config.previews as Record<string, unknown>;
        const vars = previews.vars as Record<string, string>;
        vars.WE_MET_PREVIEW_HOST_SUFFIX = "";
      },
    },
    {
      label: "previews.vars.WE_MET_PREVIEW_HOST_SUFFIX lacks -we-met. prefix",
      message: 'previews.vars.WE_MET_PREVIEW_HOST_SUFFIX must start with "-we-met."',
      mutate: (config: Record<string, unknown>) => {
        const previews = config.previews as Record<string, unknown>;
        const vars = previews.vars as Record<string, string>;
        vars.WE_MET_PREVIEW_HOST_SUFFIX = ".wrong.workers.dev";
      },
    },
    {
      label: "top-level vars.WE_MET_PREVIEW_HOST_SUFFIX is non-empty",
      message: 'top-level vars.WE_MET_PREVIEW_HOST_SUFFIX must be ""',
      mutate: (config: Record<string, unknown>) => {
        const vars = config.vars as Record<string, string>;
        vars.WE_MET_PREVIEW_HOST_SUFFIX = "-we-met.preview.workers.dev";
      },
    },
  ] as const;

  for (const { label, message, mutate } of previewHostSuffixCases) {
    it(`fails when ${label}`, () => {
      const { path } = writeTempConfig(mutate);
      const target = message.includes("top-level") ? "production" : "preview";
      const result = runGuards(target, path);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(message);
    });
  }

  const CONSUMER_NONPROD =
    "workers/we-met-followup-email-consumer/wrangler.nonprod.jsonc";
  const CONSUMER_PRODUCTION =
    "workers/we-met-followup-email-consumer/wrangler.production.jsonc";

  function writeTempConsumerConfig(
    sourcePath: string,
    mutator: (config: Record<string, unknown>) => void,
  ) {
    const dir = mkdtempSync(join(tmpdir(), "we-met-consumer-guards-"));
    tempDirs.push(dir);
    const base = readFileSync(sourcePath, "utf8");
    const config = parseJsonc(base) as Record<string, unknown>;
    mutator(config);
    const path = join(dir, "wrangler.jsonc");
    writeFileSync(path, JSON.stringify(config, null, 2), "utf8");
    return path;
  }

  it("passes consumer-nonprod guards on committed config", () => {
    const result = runGuards("consumer-nonprod", CONSUMER_NONPROD);
    expect(result.status).toBe(0);
  });

  it("passes consumer-production guards on committed config", () => {
    const result = runGuards("consumer-production", CONSUMER_PRODUCTION);
    expect(result.status).toBe(0);
  });

  it("fails consumer-nonprod when vars contain WE_MET_TEST_MAIL_TO key", () => {
    const dir = mkdtempSync(join(tmpdir(), "we-met-consumer-guards-"));
    tempDirs.push(dir);
    const base = readFileSync(CONSUMER_NONPROD, "utf8");
    const config = parseJsonc(base) as Record<string, unknown>;
    const vars = config.vars as Record<string, string>;
    vars.WE_MET_TEST_MAIL_TO = "inbox@example.com";
    const path = join(dir, "wrangler.jsonc");
    writeFileSync(path, JSON.stringify(config, null, 2), "utf8");
    const result = runGuards("consumer-nonprod", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/WE_MET_TEST_MAIL_TO|consumer vars may only/);
  });

  it("fails consumer-nonprod when vars contain disallowed keys", () => {
    const dir = mkdtempSync(join(tmpdir(), "we-met-consumer-guards-"));
    tempDirs.push(dir);
    const base = readFileSync(CONSUMER_NONPROD, "utf8");
    const config = parseJsonc(base) as Record<string, unknown>;
    const vars = config.vars as Record<string, string>;
    vars.WE_MET_BASE_URL = "https://we-met.link";
    const path = join(dir, "wrangler.jsonc");
    writeFileSync(path, JSON.stringify(config, null, 2), "utf8");
    const result = runGuards("consumer-nonprod", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("consumer vars may only");
  });

  it("fails consumer-nonprod when D1 bindings are missing", () => {
    const path = writeTempConsumerConfig(CONSUMER_NONPROD, (config) => {
      delete config.d1_databases;
    });
    const result = runGuards("consumer-nonprod", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("exactly one D1");
  });

  it("fails consumer-nonprod when two D1 bindings are present", () => {
    const path = writeTempConsumerConfig(CONSUMER_NONPROD, (config) => {
      const rows = config.d1_databases as Record<string, unknown>[];
      config.d1_databases = [...rows, { ...rows[0] }];
    });
    const result = runGuards("consumer-nonprod", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("exactly one D1");
  });

  it("fails consumer-nonprod when D1 database_name is wrong", () => {
    const path = writeTempConsumerConfig(CONSUMER_NONPROD, (config) => {
      const rows = config.d1_databases as { database_name: string }[];
      rows[0].database_name = "we-met-db";
    });
    const result = runGuards("consumer-nonprod", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/database_name|production resource/);
  });

  it("fails consumer-production when D1 references non-prod database name", () => {
    const path = writeTempConsumerConfig(CONSUMER_PRODUCTION, (config) => {
      const rows = config.d1_databases as { database_name: string }[];
      rows[0].database_name = "we-met-db-nonprod";
    });
    const result = runGuards("consumer-production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/database_name|non-prod resource/);
  });

  it("fails consumer-nonprod when dead_letter_queue is set", () => {
    const path = writeTempConsumerConfig(CONSUMER_NONPROD, (config) => {
      const consumers = (config.queues as { consumers: Record<string, unknown>[] })
        .consumers;
      consumers[0].dead_letter_queue = "dlq";
    });
    const result = runGuards("consumer-nonprod", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("dead_letter_queue");
  });

  it("fails consumer-nonprod when max_retries does not match code", () => {
    const path = writeTempConsumerConfig(CONSUMER_NONPROD, (config) => {
      const consumers = (config.queues as { consumers: { max_retries: number }[] })
        .consumers;
      consumers[0].max_retries = 5;
    });
    const result = runGuards("consumer-nonprod", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("max_retries");
  });

  it("fails consumer-nonprod when retry_delay does not match code", () => {
    const path = writeTempConsumerConfig(CONSUMER_NONPROD, (config) => {
      const consumers = (config.queues as { consumers: { retry_delay: number }[] })
        .consumers;
      consumers[0].retry_delay = 60;
    });
    const result = runGuards("consumer-nonprod", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("retry_delay");
  });

  it("fails consumer-production when config references WE_MET_TEST_MAIL_TO", () => {
    const path = writeTempConsumerConfig(CONSUMER_PRODUCTION, (config) => {
      const vars = config.vars as Record<string, string>;
      vars.WE_MET_TEST_MAIL_TO = "inbox@example.com";
    });
    const result = runGuards("consumer-production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/WE_MET_TEST_MAIL_TO|consumer vars may only/);
  });
});
