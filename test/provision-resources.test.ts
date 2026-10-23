import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCloudflareProvisionClient,
  isCloudflareNotFound,
  parseCloudflareJsonBody,
} from "../scripts/lib/cloudflare-provision-api.mjs";
import {
  assertNameAllowedForTarget,
  buildProvisionPlan,
  collectDeclaredResources,
  d1EnvVarForDatabaseName,
  executeProvisionPlan,
  lookupDeclaredD1,
  validateDeclaredNames,
  validateD1IdsAgainstEnv,
} from "../scripts/lib/provision-resources.mjs";
import {
  provisionLogLinesWithoutMasks,
  runProvisionForDeclared,
} from "../scripts/lib/provision-run.mjs";

const MAIN_CONFIG = {
  d1_databases: [{ binding: "WE_MET_DB", database_name: "we-met-db" }],
  r2_buckets: [{ binding: "WE_MET_ASSETS", bucket_name: "we-met-assets" }],
  previews: {
    d1_databases: [{ binding: "WE_MET_DB", database_name: "we-met-db-nonprod" }],
    r2_buckets: [{ binding: "WE_MET_ASSETS", bucket_name: "we-met-assets-nonprod" }],
  },
};

function fakeApi(state: {
  d1?: Record<string, string>;
  r2?: Set<string>;
  calls?: { d1Get: string[]; r2Get: string[] };
}) {
  const d1 = { ...(state.d1 ?? {}) };
  const r2 = new Set(state.r2 ?? []);
  const calls = state.calls ?? { d1Get: [], r2Get: [] };
  return {
    calls,
    api: {
      async getD1Database(name: string) {
        calls.d1Get.push(name);
        const uuid = d1[name];
        return uuid ? { name, uuid } : null;
      },
      async r2BucketExists(name: string) {
        calls.r2Get.push(name);
        return r2.has(name);
      },
      async createD1Database(name: string) {
        const uuid = `created-${name}`;
        d1[name] = uuid;
        return { name, uuid };
      },
      async createR2Bucket(name: string) {
        r2.add(name);
      },
    },
  };
}

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
  vi.restoreAllMocks();
});

describe("provision-resources (unit)", () => {
  it("collects only target-scoped names", () => {
    const prod = collectDeclaredResources(MAIN_CONFIG, null, "production");
    expect(prod.d1).toEqual(["we-met-db"]);
    const nonprod = collectDeclaredResources(MAIN_CONFIG, null, "nonprod");
    expect(nonprod.d1).toEqual(["we-met-db-nonprod"]);
  });

  it("resolves only declared D1 names per target when both exist in account", async () => {
    const { api, calls } = fakeApi({
      d1: {
        "we-met-db": "prod-uuid",
        "we-met-db-nonprod": "nonprod-uuid",
      },
    });
    const prodRows = await lookupDeclaredD1(["we-met-db"], api);
    expect(prodRows).toEqual([{ name: "we-met-db", uuid: "prod-uuid" }]);
    expect(calls.d1Get).toEqual(["we-met-db"]);

    calls.d1Get.length = 0;
    const nonprodRows = await lookupDeclaredD1(["we-met-db-nonprod"], api);
    expect(nonprodRows[0].uuid).toBe("nonprod-uuid");
    expect(calls.d1Get).toEqual(["we-met-db-nonprod"]);
  });

  it("plans and executes create for missing resources", async () => {
    const { api } = fakeApi({ d1: {}, r2: new Set() });
    const plan = buildProvisionPlan(["we-met-db"], ["we-met-assets"], [], []);
    const { log, resolvedD1Ids } = await executeProvisionPlan(
      plan as { action: "create" | "skip"; kind: "d1" | "r2"; name: string }[],
      api,
      [],
    );
    expect(log.some((e) => e.message.includes("created"))).toBe(true);
    expect(resolvedD1Ids).toMatchObject({ "we-met-db": "created-we-met-db" });
  });

  it("refuses wrong-env names", () => {
    expect(validateDeclaredNames(["we-met-db"], [], "nonprod").length).toBe(1);
    expect(validateDeclaredNames(["we-met-db-nonprod"], [], "production").length).toBe(
      1,
    );
    expect(assertNameAllowedForTarget("we-met-db", "production")).toBeNull();
  });

  it("additional database env var slug strips -nonprod once", () => {
    expect(d1EnvVarForDatabaseName("we-met-extra-db-nonprod", "nonprod")).toBe(
      "WE_MET_D1_DATABASE_ID_WE_MET_EXTRA_DB_NONPROD",
    );
  });

  it("does not print D1 ids to stdout", async () => {
    const dir = mkdtempSync(join(tmpdir(), "we-met-prov-out-"));
    tempDirs.push(dir);
    const outputPath = join(dir, "provision-d1-ids.json");
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.join(" "));
    });
    const { api } = fakeApi({
      d1: { "we-met-db": "secret-uuid-1111-1111-1111-111111111111" },
      r2: new Set(["we-met-assets"]),
    });
    await runProvisionForDeclared({
      target: "production",
      d1: ["we-met-db"],
      r2: ["we-met-assets"],
      api,
      env: {
        WE_MET_D1_DATABASE_ID_PRODUCTION: "secret-uuid-1111-1111-1111-111111111111",
      },
      outputPath,
    });
    spy.mockRestore();
    const visible = provisionLogLinesWithoutMasks(logs);
    expect(visible.join("\n")).not.toContain("secret-uuid");
    expect(visible.join("\n")).toContain("present");
    expect(logs.some((line) => line.startsWith("::add-mask::"))).toBe(true);
    const file = JSON.parse(readFileSync(outputPath, "utf8")) as {
      d1: Record<string, string>;
    };
    expect(file.d1["we-met-db"]).toContain("secret-uuid");
  });

  it("skips R2 lookups when resources list is d1-only", async () => {
    const { api, calls } = fakeApi({
      d1: { "we-met-db-nonprod": "n" },
      r2: new Set(["we-met-assets-nonprod"]),
    });
    const d1 = ["we-met-db-nonprod"];
    const r2: string[] = [];
    await lookupDeclaredD1(d1, api);
    expect(calls.r2Get).toEqual([]);
    const plan = buildProvisionPlan(d1, r2, await lookupDeclaredD1(d1, api), []);
    await executeProvisionPlan(
      plan as { action: "create" | "skip"; kind: "d1" | "r2"; name: string }[],
      api,
      await lookupDeclaredD1(d1, api),
    );
    expect(calls.r2Get).toEqual([]);
  });

  it("validates env override without echoing ids", () => {
    const errors = validateD1IdsAgainstEnv({ "we-met-db": "uuid-a" }, "production", {
      WE_MET_D1_DATABASE_ID_PRODUCTION: "uuid-b",
    });
    expect(errors[0]).toContain("does not match");
    expect(errors[0]).not.toContain("uuid-a");
  });
});

describe("cloudflare-provision-api (unit)", () => {
  it("parseCloudflareJsonBody throws on empty output", () => {
    expect(() => parseCloudflareJsonBody("", "test")).toThrow(/empty/);
  });

  it("parseCloudflareJsonBody throws on invalid JSON", () => {
    expect(() => parseCloudflareJsonBody("{", "test")).toThrow(/unparseable/);
  });

  it("createCloudflareProvisionClient throws on API error (not not-found)", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 403,
      text: async () =>
        JSON.stringify({ success: false, errors: [{ code: 10000, message: "auth" }] }),
    }));
    const client = createCloudflareProvisionClient(
      fetchImpl as unknown as typeof fetch,
      {
        accountId: "acct",
        apiToken: "token",
      },
    );
    await expect(client.getD1Database("we-met-db")).rejects.toThrow(/failed/);
  });

  it("createCloudflareProvisionClient treats 404 as missing D1", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 404,
      text: async () =>
        JSON.stringify({
          success: false,
          errors: [{ code: 7404, message: "not found" }],
        }),
    }));
    const client = createCloudflareProvisionClient(
      fetchImpl as unknown as typeof fetch,
      {
        accountId: "acct",
        apiToken: "token",
      },
    );
    await expect(client.getD1Database("missing-db")).resolves.toBeNull();
  });

  it("getD1Database uses list API with name query", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe(
        "https://api.cloudflare.com/client/v4/accounts/acct/d1/database?name=" +
          encodeURIComponent("we-met-db"),
      );
      return {
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            result: [{ name: "we-met-db", uuid: "uuid-1" }],
          }),
      };
    });
    const client = createCloudflareProvisionClient(
      fetchImpl as unknown as typeof fetch,
      {
        accountId: "acct",
        apiToken: "token",
      },
    );
    await expect(client.getD1Database("we-met-db")).resolves.toEqual({
      name: "we-met-db",
      uuid: "uuid-1",
    });
  });

  it("createCloudflareProvisionClient throws on non-404 with not-found-like error codes", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 403,
      text: async () =>
        JSON.stringify({
          success: false,
          errors: [{ code: 10013, message: "not found" }],
        }),
    }));
    const client = createCloudflareProvisionClient(
      fetchImpl as unknown as typeof fetch,
      {
        accountId: "acct",
        apiToken: "token",
      },
    );
    await expect(client.getD1Database("we-met-db")).rejects.toThrow(/failed/);
  });

  it("isCloudflareNotFound only treats HTTP 404 as not found", () => {
    expect(isCloudflareNotFound(404)).toBe(true);
    expect(isCloudflareNotFound(403)).toBe(false);
    expect(isCloudflareNotFound(500)).toBe(false);
    expect(isCloudflareNotFound(200)).toBe(false);
  });
});

describe("provision-resources CLI (unit)", () => {
  it("exits non-zero when Cloudflare returns auth error", () => {
    const result = spawnSync(
      "node",
      [
        "scripts/provision-resources.mjs",
        "--target",
        "production",
        "--config",
        "wrangler.jsonc",
        "--output",
        join(tmpdir(), `provision-cli-${process.pid}.json`),
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: "invalid-token-for-test",
          CLOUDFLARE_ACCOUNT_ID: "00000000000000000000000000000000",
        },
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });
});
