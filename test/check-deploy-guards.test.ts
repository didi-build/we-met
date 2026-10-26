import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { parseJsonc } from "../scripts/lib/parse-jsonc.mjs";

const SCRIPT = "scripts/check-deploy-guards.mjs";
const BASE_CONFIG = readFileSync("wrangler.jsonc", "utf8");
const STAGING_BASE_CONFIG = readFileSync("wrangler.staging.jsonc", "utf8");
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

function writeTempStagingConfig(mutator: (config: Record<string, unknown>) => void) {
  const dir = mkdtempSync(join(tmpdir(), "we-met-staging-guards-"));
  tempDirs.push(dir);
  const path = join(dir, "wrangler.staging.jsonc");
  const config = parseJsonc(STAGING_BASE_CONFIG) as Record<string, unknown>;
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

  it("passes staging guards on committed wrangler.staging.jsonc", () => {
    const result = runGuards("staging", "wrangler.staging.jsonc");
    expect(result.status).toBe(0);
  });

  it("fails when top-level WE_MET_PREVIEW_LOGIN_SECRET is set on production config", () => {
    const { path } = writeTempConfig((config) => {
      const vars = config.vars as Record<string, string>;
      vars.WE_MET_PREVIEW_LOGIN_SECRET = "must-not-be-in-top-level-vars";
    });
    const result = runGuards("production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("WE_MET_PREVIEW_LOGIN_SECRET");
  });

  it("fails when top-level WE_MET_ENV is preview (preview-login must not use production Worker vars)", () => {
    const { path } = writeTempConfig((config) => {
      const vars = config.vars as Record<string, string>;
      vars.WE_MET_ENV = "preview";
    });
    const result = runGuards("production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('top-level WE_MET_ENV must be "production"');
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

  it("fails when production D1 has no previews counterpart binding", () => {
    const { path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      previews.d1_databases = [];
    });
    const result = runGuards("production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("previews.d1_databases is required");
  });

  it("fails when previews D1 database_name is not prod name plus -nonprod", () => {
    const { path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const previewD1 = previews.d1_databases as { database_name: string }[];
      previewD1[0].database_name = "we-met-db-wrong-nonprod";
    });
    const result = runGuards("production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/we-met-db-nonprod|preview D1/);
  });

  it("fails when previews R2 bucket_name is not prod name plus -nonprod", () => {
    const { path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const previewR2 = previews.r2_buckets as { bucket_name: string }[];
      previewR2[0].bucket_name = "we-met-assets-wrong-nonprod";
    });
    const result = runGuards("production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/we-met-assets-nonprod|preview R2/);
  });

  it("fails when production D1 database_name is missing in pairing check", () => {
    const { path } = writeTempConfig((config) => {
      const d1 = config.d1_databases as { database_name?: string }[];
      delete d1[0].database_name;
    });
    const result = runGuards("production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/database_name is required|production D1 name/);
  });

  it("fails when preview D1 binding name is not paired with production", () => {
    const { path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      const previewD1 = previews.d1_databases as { binding: string }[];
      previewD1[0].binding = "WE_MET_DB_OTHER";
    });
    const result = runGuards("production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /production missing D1 binding "WE_MET_DB_OTHER"|previews missing D1 binding "WE_MET_DB"/,
    );
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

  it("fails when production routes omit app.we-met.link", () => {
    const { path } = writeTempConfig((config) => {
      config.routes = [{ pattern: "we-met.link", custom_domain: true }];
    });
    const result = runGuards("production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("app.we-met.link");
  });

  it("fails when previews.routes includes app.we-met.link", () => {
    const { path } = writeTempConfig((config) => {
      const previews = config.previews as Record<string, unknown>;
      previews.routes = [{ pattern: "app.we-met.link", custom_domain: true }];
    });
    const result = runGuards("preview", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("app.we-met.link");
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

  const stagingGuardCases = [
    {
      label: "staging workers_dev is true",
      message: "workers_dev must be false",
      mutate: (config: Record<string, unknown>) => {
        config.workers_dev = true;
      },
    },
    {
      label: "staging workers_dev is missing",
      message: "workers_dev must be false",
      mutate: (config: Record<string, unknown>) => {
        delete config.workers_dev;
      },
    },
    {
      label: "staging preview_urls is true",
      message: "preview_urls must be false",
      mutate: (config: Record<string, unknown>) => {
        config.preview_urls = true;
      },
    },
    {
      label: "staging preview_urls is missing",
      message: "preview_urls must be false",
      mutate: (config: Record<string, unknown>) => {
        delete config.preview_urls;
      },
    },
    {
      label: "staging config uses singular route",
      message: "singular route",
      mutate: (config: Record<string, unknown>) => {
        config.route = { pattern: "we-met.didi.build", custom_domain: true };
      },
    },
    {
      label: "staging config defines env blocks",
      message: "env blocks",
      mutate: (config: Record<string, unknown>) => {
        config.env = { staging: { vars: { WE_MET_ENV: "staging" } } };
      },
    },
    {
      label: "staging binds kv_namespaces",
      message: "kv_namespaces",
      mutate: (config: Record<string, unknown>) => {
        config.kv_namespaces = [
          { binding: "KV", id: "00000000-0000-0000-0000-000000000099" },
        ];
      },
    },
    {
      label: "staging binds durable_objects (array form)",
      message: "durable_objects",
      mutate: (config: Record<string, unknown>) => {
        config.durable_objects = [{ name: "DO", class_name: "Example" }];
      },
    },
    {
      label: "staging binds durable_objects (Wrangler bindings object)",
      message: "durable_objects",
      mutate: (config: Record<string, unknown>) => {
        config.durable_objects = {
          bindings: [{ name: "DO", class_name: "Example" }],
        };
      },
    },
    {
      label: "staging config includes a previews block",
      message: "previews block",
      mutate: (config: Record<string, unknown>) => {
        config.previews = { vars: { WE_MET_ENV: "preview" } };
      },
    },
    {
      label: "staging Worker name is not we-met-staging",
      message: 'Worker name must be "we-met-staging"',
      mutate: (config: Record<string, unknown>) => {
        config.name = "not-staging";
      },
    },
    {
      label: "staging vars include a disallowed key",
      message: "staging vars may only contain",
      mutate: (config: Record<string, unknown>) => {
        const vars = config.vars as Record<string, string>;
        vars.WE_MET_DISALLOWED_EXAMPLE = "nope";
      },
    },
    {
      label: "staging vars.WE_MET_ENV is missing",
      message: 'vars.WE_MET_ENV must be "staging"',
      mutate: (config: Record<string, unknown>) => {
        const vars = config.vars as Record<string, string>;
        delete vars.WE_MET_ENV;
      },
    },
    {
      label: "staging vars.WE_MET_ENV is not staging",
      message: 'vars.WE_MET_ENV must be "staging"',
      mutate: (config: Record<string, unknown>) => {
        const vars = config.vars as Record<string, string>;
        vars.WE_MET_ENV = "production";
      },
    },
    {
      label: "staging vars.WE_MET_PREVIEW_HOST_SUFFIX is non-empty",
      message: 'WE_MET_PREVIEW_HOST_SUFFIX must be ""',
      mutate: (config: Record<string, unknown>) => {
        const vars = config.vars as Record<string, string>;
        vars.WE_MET_PREVIEW_HOST_SUFFIX = "-we-met.preview.workers.dev";
      },
    },
    {
      label: "staging vars.WE_MET_BASE_URL is https://we-met.link",
      message: "https://we-met.didi.build",
      mutate: (config: Record<string, unknown>) => {
        const vars = config.vars as Record<string, string>;
        vars.WE_MET_BASE_URL = "https://we-met.link";
      },
    },
    {
      label: "staging vars.WE_MET_BASE_URL is https://evil.example",
      message: "https://we-met.didi.build",
      mutate: (config: Record<string, unknown>) => {
        const vars = config.vars as Record<string, string>;
        vars.WE_MET_BASE_URL = "https://evil.example";
      },
    },
    {
      label: "staging vars.WE_MET_BASE_URL is missing",
      message: "https://we-met.didi.build",
      mutate: (config: Record<string, unknown>) => {
        const vars = config.vars as Record<string, string>;
        delete vars.WE_MET_BASE_URL;
      },
    },
    {
      label: "staging vars include WE_MET_PREVIEW_LOGIN_SECRET",
      message: "WE_MET_PREVIEW_LOGIN_SECRET",
      mutate: (config: Record<string, unknown>) => {
        const vars = config.vars as Record<string, string>;
        vars.WE_MET_PREVIEW_LOGIN_SECRET = "must-not-be-in-staging-vars";
      },
    },
    {
      label: "staging vars include WE_MET_PREVIEW_LOGIN_EMAIL",
      message: "WE_MET_PREVIEW_LOGIN_EMAIL",
      mutate: (config: Record<string, unknown>) => {
        const vars = config.vars as Record<string, string>;
        vars.WE_MET_PREVIEW_LOGIN_EMAIL = "preview@example.com";
      },
    },
    {
      label: "staging references production host we-met.link in bindings",
      message: 'production resource "we-met.link"',
      mutate: (config: Record<string, unknown>) => {
        const rl = config.ratelimits as { namespace_id: string }[];
        rl[0].namespace_id = "we-met.link";
      },
    },
    {
      label: "staging references production D1 name we-met-db",
      message: 'production resource "we-met-db"',
      mutate: (config: Record<string, unknown>) => {
        const d1 = config.d1_databases as { database_name: string }[];
        d1[0].database_name = "we-met-db";
      },
    },
    {
      label: "staging references production R2 bucket we-met-assets",
      message: 'production resource "we-met-assets"',
      mutate: (config: Record<string, unknown>) => {
        const r2 = config.r2_buckets as { bucket_name: string }[];
        r2[0].bucket_name = "we-met-assets";
      },
    },
    {
      label: "staging references production queue we-met-followup-email",
      message: 'production resource "we-met-followup-email"',
      mutate: (config: Record<string, unknown>) => {
        const queues = config.queues as { producers: { queue: string }[] };
        queues.producers[0].queue = "we-met-followup-email";
      },
    },
    {
      label: "staging references production rate limiter namespace 2002",
      message: 'production resource "2002"',
      mutate: (config: Record<string, unknown>) => {
        const rl = config.ratelimits as { namespace_id: string }[];
        rl[0].namespace_id = "2002";
      },
    },
    {
      label: "staging references production Worker name we-met in services",
      message: 'production resource "we-met"',
      mutate: (config: Record<string, unknown>) => {
        const services = config.services as { service: string }[];
        services[0].service = "we-met";
      },
    },
    {
      label: "staging route is we-met.link",
      message: /we-met\.didi\.build|production resource "we-met\.link"/,
      mutate: (config: Record<string, unknown>) => {
        config.routes = [{ pattern: "we-met.link", custom_domain: true }];
      },
    },
    {
      label: "staging route is app.we-met.link",
      message: "we-met.didi.build",
      mutate: (config: Record<string, unknown>) => {
        config.routes = [{ pattern: "app.we-met.link", custom_domain: true }];
      },
    },
    {
      label: "staging route is not we-met.didi.build",
      message: "we-met.didi.build",
      mutate: (config: Record<string, unknown>) => {
        config.routes = [{ pattern: "evil.example", custom_domain: true }];
      },
    },
    {
      label: "staging route custom_domain is false",
      message: "custom_domain true",
      mutate: (config: Record<string, unknown>) => {
        config.routes = [{ pattern: "we-met.didi.build", custom_domain: false }];
      },
    },
    {
      label: "staging route custom_domain is missing",
      message: "custom_domain true",
      mutate: (config: Record<string, unknown>) => {
        config.routes = [{ pattern: "we-met.didi.build" }];
      },
    },
    {
      label: "staging D1 database_id uses production placeholder",
      message: "production placeholder",
      mutate: (config: Record<string, unknown>) => {
        const d1 = config.d1_databases as { database_id: string }[];
        d1[0].database_id = "00000000-0000-0000-0000-000000000001";
      },
    },
    {
      label: "staging D1 database_name is not we-met-db-nonprod",
      message: "we-met-db-nonprod",
      mutate: (config: Record<string, unknown>) => {
        const d1 = config.d1_databases as { database_name: string }[];
        d1[0].database_name = "we-met-db-wrong-nonprod";
      },
    },
    {
      label: "staging R2 bucket is not we-met-assets-nonprod",
      message: "we-met-assets-nonprod",
      mutate: (config: Record<string, unknown>) => {
        const r2 = config.r2_buckets as { bucket_name: string }[];
        r2[0].bucket_name = "we-met-assets-wrong-nonprod";
      },
    },
    {
      label: "staging queue producer is not we-met-followup-email-nonprod",
      message: "we-met-followup-email-nonprod",
      mutate: (config: Record<string, unknown>) => {
        const queues = config.queues as { producers: { queue: string }[] };
        queues.producers[0].queue = "we-met-other-nonprod";
      },
    },
    {
      label: "staging exchange rate limiter namespace is not non-prod",
      message: "preview rate limiter",
      mutate: (config: Record<string, unknown>) => {
        const rl = config.ratelimits as { namespace_id: string; name: string }[];
        const exchange = rl.find((row) => row.name === "WE_MET_EXCHANGE_RATE_LIMITER");
        if (exchange) exchange.namespace_id = "1999";
      },
    },
    {
      label: "staging WORKER_SELF_REFERENCE is not we-met-staging",
      message: 'must target "we-met-staging"',
      mutate: (config: Record<string, unknown>) => {
        const services = config.services as { service: string }[];
        services[0].service = "not-staging";
      },
    },
    {
      label: "staging WORKER_SELF_REFERENCE targets production Worker we-met",
      message: 'production resource "we-met"',
      mutate: (config: Record<string, unknown>) => {
        const services = config.services as { service: string }[];
        services[0].service = "we-met";
      },
    },
    {
      label: "staging binds send_email",
      message: "send_email",
      mutate: (config: Record<string, unknown>) => {
        config.send_email = { name: "EMAIL" };
      },
    },
    {
      label: "staging defines triggers.crons",
      message: "triggers.crons",
      mutate: (config: Record<string, unknown>) => {
        config.triggers = { crons: ["0 * * * *"] };
      },
    },
    {
      label: "staging defines queue consumers",
      message: "queue consumers",
      mutate: (config: Record<string, unknown>) => {
        const queues = config.queues as { producers: unknown[]; consumers: unknown[] };
        queues.consumers = [{ queue: "we-met-followup-email-nonprod" }];
      },
    },
  ] as const;

  for (const { label, message, mutate } of stagingGuardCases) {
    it(`fails staging guards when ${label}`, () => {
      const { path } = writeTempStagingConfig(mutate);
      const result = runGuards("staging", path);
      expect(result.status).toBe(1);
      if (message instanceof RegExp) {
        expect(result.stderr).toMatch(message);
      } else {
        expect(result.stderr).toContain(message);
      }
    });
  }

  it("fails staging guards when two routes are configured", () => {
    const { path } = writeTempStagingConfig((config) => {
      config.routes = [
        { pattern: "we-met.didi.build", custom_domain: true },
        { pattern: "extra.didi.build", custom_domain: true },
      ];
    });
    const result = runGuards("staging", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "staging routes must be only custom domain we-met.didi.build",
    );
  });

  it("fails staging guards when D1 bindings are missing", () => {
    const { path } = writeTempStagingConfig((config) => {
      delete config.d1_databases;
    });
    const result = runGuards("staging", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("staging must bind exactly one D1 database");
  });

  it("fails staging guards when two D1 bindings are present", () => {
    const { path } = writeTempStagingConfig((config) => {
      const rows = config.d1_databases as Record<string, unknown>[];
      config.d1_databases = [...rows, { ...rows[0] }];
    });
    const result = runGuards("staging", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("staging must bind exactly one D1 database");
  });

  it("fails staging guards when D1 database_id is not the non-prod placeholder without substitution", () => {
    const { path } = writeTempStagingConfig((config) => {
      const d1 = config.d1_databases as { database_id: string }[];
      d1[0].database_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    });
    const result = runGuards("staging", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "staging D1 database_id must use non-prod placeholder",
    );
  });

  it("fails staging guards when services bindings are missing", () => {
    const { path } = writeTempStagingConfig((config) => {
      delete config.services;
    });
    const result = runGuards("staging", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "staging must declare exactly one services binding",
    );
  });

  it("fails staging guards when services binding name is wrong", () => {
    const { path } = writeTempStagingConfig((config) => {
      const services = config.services as { binding: string; service: string }[];
      services[0].binding = "WRONG_BINDING";
    });
    const result = runGuards("staging", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'staging services binding must be "WORKER_SELF_REFERENCE"',
    );
  });

  it("fails staging guards with exact preview-login var error messages", () => {
    const secretPath = writeTempStagingConfig((config) => {
      const vars = config.vars as Record<string, string>;
      vars.WE_MET_PREVIEW_LOGIN_SECRET = "secret";
    }).path;
    const secretResult = runGuards("staging", secretPath);
    expect(secretResult.stderr).toContain(
      "staging vars must not include WE_MET_PREVIEW_LOGIN_SECRET",
    );

    const emailPath = writeTempStagingConfig((config) => {
      const vars = config.vars as Record<string, string>;
      vars.WE_MET_PREVIEW_LOGIN_EMAIL = "preview@example.com";
    }).path;
    const emailResult = runGuards("staging", emailPath);
    expect(emailResult.stderr).toContain(
      "staging vars must not include WE_MET_PREVIEW_LOGIN_EMAIL",
    );
  });

  it("fails staging guards when CONTACTS_SETUP_ENABLED_FOR_ALL is not false", () => {
    const { path } = writeTempStagingConfig((config) => {
      const vars = config.vars as Record<string, string>;
      vars.CONTACTS_SETUP_ENABLED_FOR_ALL = "true";
    });
    const result = runGuards("staging", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'staging vars.CONTACTS_SETUP_ENABLED_FOR_ALL must be "false"',
    );
  });

  it("passes staging-build guards when build env is correct", () => {
    const result = spawnSync(
      "node",
      [SCRIPT, "--target", "staging-build", "--config", "wrangler.staging.jsonc"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          WE_MET_ENV: "staging",
          WE_MET_BASE_URL: "https://we-met.didi.build",
          WE_MET_PREVIEW_HOST_SUFFIX: "",
        },
      },
    );
    expect(result.status).toBe(0);
  });

  it("fails staging-build guards when WE_MET_ENV is missing", () => {
    const result = spawnSync(
      "node",
      [SCRIPT, "--target", "staging-build", "--config", "wrangler.staging.jsonc"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          WE_MET_ENV: "",
          WE_MET_BASE_URL: "https://we-met.didi.build",
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('staging build requires WE_MET_ENV "staging"');
  });

  it("fails staging guards when D1 database_id does not match non-prod id after substitution", () => {
    const { path } = writeTempStagingConfig((config) => {
      const d1 = config.d1_databases as { database_id: string }[];
      d1[0].database_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    });
    const result = spawnSync(
      "node",
      [SCRIPT, "--target", "staging", "--config", path],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          WE_MET_D1_DATABASE_ID_NONPROD: "22222222-2222-2222-2222-222222222222",
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("non-prod database_id");
  });

  it("fails staging guards when D1 database_id equals production id after substitution", () => {
    const same = "11111111-1111-1111-1111-111111111111";
    const { path } = writeTempStagingConfig((config) => {
      const d1 = config.d1_databases as { database_id: string }[];
      d1[0].database_id = same;
    });
    const result = spawnSync(
      "node",
      [SCRIPT, "--target", "staging", "--config", path],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          WE_MET_D1_DATABASE_ID_PRODUCTION: same,
          WE_MET_D1_DATABASE_ID_NONPROD: "22222222-2222-2222-2222-222222222222",
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("production database_id");
  });

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

  const WARMUP_CONFIG = "workers/warmup/wrangler.jsonc";

  function writeTempWarmupConfig(mutator: (config: Record<string, unknown>) => void) {
    const dir = mkdtempSync(join(tmpdir(), "we-met-warmup-guards-"));
    tempDirs.push(dir);
    const base = readFileSync(WARMUP_CONFIG, "utf8");
    const config = parseJsonc(base) as Record<string, unknown>;
    mutator(config);
    const path = join(dir, "wrangler.jsonc");
    writeFileSync(path, JSON.stringify(config, null, 2), "utf8");
    return path;
  }

  it("passes warmup-production guards on committed config", () => {
    const result = runGuards("warmup-production", WARMUP_CONFIG);
    expect(result.status).toBe(0);
  });

  it("fails warmup-production when WARMUP_STATE namespace id is the zero placeholder", () => {
    const path = writeTempWarmupConfig((config) => {
      const kv = config.kv_namespaces as { binding: string; id: string }[];
      kv[0].id = "00000000-0000-0000-0000-000000000000";
    });
    const result = runGuards("warmup-production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("zero placeholder");
  });

  it("fails warmup-production when email-events queue names are still placeholders", () => {
    const path = writeTempWarmupConfig((config) => {
      const consumers = config.queues as { consumers: { queue: string }[] };
      const emailConsumer = consumers.consumers.find(
        (row) => row.queue === "we-met-warmup-email-events",
      );
      if (emailConsumer) {
        emailConsumer.queue = "00000000-0000-0000-0000-000000000003";
      }
    });
    const result = runGuards("warmup-production", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("email-events");
    expect(result.stderr).toContain("placeholder");
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
    vars.WE_MET_DISALLOWED_EXAMPLE = "nope";
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

  const consumerPublicUrlCases = [
    {
      label: "workers_dev missing",
      mutate: (config: Record<string, unknown>) => {
        delete config.workers_dev;
      },
      message: "workers_dev must be false",
    },
    {
      label: "workers_dev true",
      mutate: (config: Record<string, unknown>) => {
        config.workers_dev = true;
      },
      message: "workers_dev must be false",
    },
    {
      label: "preview_urls missing",
      mutate: (config: Record<string, unknown>) => {
        delete config.preview_urls;
      },
      message: "preview_urls must be false",
    },
    {
      label: "preview_urls true",
      mutate: (config: Record<string, unknown>) => {
        config.preview_urls = true;
      },
      message: "preview_urls must be false",
    },
  ] as const;

  for (const target of ["consumer-nonprod", "consumer-production"] as const) {
    const source =
      target === "consumer-nonprod" ? CONSUMER_NONPROD : CONSUMER_PRODUCTION;
    for (const { label, mutate, message } of consumerPublicUrlCases) {
      it(`fails ${target} when ${label}`, () => {
        const path = writeTempConsumerConfig(source, mutate);
        const result = runGuards(target, path);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(message);
      });
    }
  }

  it("keeps consumer public URL flags on prepared nonprod consumer config", () => {
    const outputPath = `workers/we-met-followup-email-consumer/wrangler.guards-test-${process.pid}.ci.jsonc`;
    const prep = spawnSync(
      "node",
      [
        "scripts/prepare-wrangler-config.mjs",
        "--target",
        "consumer-nonprod",
        "--output",
        outputPath,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          WE_MET_D1_DATABASE_ID_NONPROD: "22222222-2222-2222-2222-222222222222",
        },
      },
    );
    expect(prep.status).toBe(0);
    try {
      const prepared = parseJsonc(readFileSync(outputPath, "utf8")) as Record<
        string,
        unknown
      >;
      expect(prepared.workers_dev).toBe(false);
      expect(prepared.preview_urls).toBe(false);
      const result = runGuards("consumer-nonprod", outputPath);
      expect(result.status).toBe(0);
    } finally {
      rmSync(outputPath, { force: true });
    }
  });
});
