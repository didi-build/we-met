import { describe, expect, it } from "vitest";
import {
  assertNameAllowedForTarget,
  buildProvisionPlan,
  collectDeclaredResources,
  executeProvisionPlan,
  validateDeclaredNames,
  validateD1IdsAgainstEnv,
} from "../scripts/lib/provision-resources.mjs";

const MAIN_CONFIG = {
  d1_databases: [{ binding: "WE_MET_DB", database_name: "we-met-db" }],
  r2_buckets: [{ binding: "WE_MET_ASSETS", bucket_name: "we-met-assets" }],
  previews: {
    d1_databases: [{ binding: "WE_MET_DB", database_name: "we-met-db-nonprod" }],
    r2_buckets: [{ binding: "WE_MET_ASSETS", bucket_name: "we-met-assets-nonprod" }],
  },
};

const CONSUMER_PRODUCTION = {
  d1_databases: [{ binding: "WE_MET_DB", database_name: "we-met-db" }],
  r2_buckets: [{ binding: "WE_MET_ASSETS", bucket_name: "we-met-assets" }],
};

const CONSUMER_NONPROD = {
  d1_databases: [{ binding: "WE_MET_DB", database_name: "we-met-db-nonprod" }],
  r2_buckets: [{ binding: "WE_MET_ASSETS", bucket_name: "we-met-assets-nonprod" }],
};

function fakeWrangler(options: {
  d1?: { name: string; uuid: string }[];
  r2?: string[];
  onCreateD1?: (name: string) => { name: string; uuid: string };
  onCreateR2?: (name: string) => void;
}) {
  const d1 = [...(options.d1 ?? [])];
  const r2 = [...(options.r2 ?? [])];
  return {
    listD1Databases: async () => d1,
    listR2Buckets: async () => r2,
    createD1Database: async (name: string) => {
      const created = options.onCreateD1?.(name) ?? {
        name,
        uuid: `new-d1-${name}`,
      };
      d1.push(created);
      return created;
    },
    createR2Bucket: async (name: string) => {
      options.onCreateR2?.(name);
      r2.push(name);
    },
  };
}

describe("provision-resources (unit)", () => {
  it("collects production D1 and R2 from app and consumer configs", () => {
    const resources = collectDeclaredResources(
      MAIN_CONFIG,
      CONSUMER_PRODUCTION,
      "production",
    );
    expect(resources.d1).toEqual(["we-met-db"]);
    expect(resources.r2).toEqual(["we-met-assets"]);
  });

  it("collects non-prod D1 and R2 from previews and consumer configs", () => {
    const resources = collectDeclaredResources(
      MAIN_CONFIG,
      CONSUMER_NONPROD,
      "nonprod",
    );
    expect(resources.d1).toEqual(["we-met-db-nonprod"]);
    expect(resources.r2).toEqual(["we-met-assets-nonprod"]);
  });

  it("plans create for missing D1 and R2", () => {
    const plan = buildProvisionPlan(["we-met-db"], ["we-met-assets"], [], []);
    expect(plan).toEqual([
      { action: "create", kind: "d1", name: "we-met-db" },
      { action: "create", kind: "r2", name: "we-met-assets" },
    ]);
  });

  it("plans skip for existing D1 and R2", () => {
    const plan = buildProvisionPlan(
      ["we-met-db"],
      ["we-met-assets"],
      [{ name: "we-met-db", uuid: "id-1" } as { name: string }],
      ["we-met-assets"],
    );
    expect(plan).toEqual([
      { action: "skip", kind: "d1", name: "we-met-db" },
      { action: "skip", kind: "r2", name: "we-met-assets" },
    ]);
  });

  it("creates missing D1 and R2 via wrangler seam", async () => {
    const createdR2: string[] = [];
    const wrangler = fakeWrangler({
      d1: [{ name: "we-met-db", uuid: "existing-db" }],
      onCreateR2: (name) => createdR2.push(name),
    });
    const existingD1 = await wrangler.listD1Databases();
    const existingR2 = await wrangler.listR2Buckets();
    const plan = buildProvisionPlan(
      ["we-met-db"],
      ["we-met-assets-new"],
      existingD1,
      existingR2,
    );
    const { log, resolvedD1Ids } = await executeProvisionPlan(
      plan as {
        action: "create" | "skip";
        kind: "d1" | "r2";
        name: string;
      }[],
      wrangler,
      existingD1,
    );
    expect(createdR2).toEqual(["we-met-assets-new"]);
    expect(resolvedD1Ids["we-met-db"]).toBe("existing-db");
    expect(log.some((e) => e.message.includes("already exists"))).toBe(true);
    expect(log.some((e) => e.message.includes("we-met-assets-new created"))).toBe(true);
  });

  it("refuses production name under nonprod target", () => {
    const errors = validateDeclaredNames(["we-met-db"], [], "nonprod");
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("refusing non-prod");
  });

  it("refuses nonprod name under production target", () => {
    const errors = validateDeclaredNames(["we-met-db-nonprod"], [], "production");
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("refusing production");
  });

  it("assertNameAllowedForTarget covers both directions", () => {
    expect(assertNameAllowedForTarget("we-met-db", "nonprod")).toContain(
      "refusing non-prod",
    );
    expect(assertNameAllowedForTarget("we-met-db-nonprod", "production")).toContain(
      "refusing production",
    );
    expect(assertNameAllowedForTarget("we-met-db", "production")).toBeNull();
    expect(assertNameAllowedForTarget("we-met-db-nonprod", "nonprod")).toBeNull();
  });

  it("fails validation when D1 env var is unset", () => {
    const errors = validateD1IdsAgainstEnv({ "we-met-db": "uuid-1" }, "production", {});
    expect(errors[0]).toContain("WE_MET_D1_DATABASE_ID_PRODUCTION");
  });

  it("fails validation when D1 env var does not match Cloudflare id", () => {
    const errors = validateD1IdsAgainstEnv(
      { "we-met-db-nonprod": "uuid-2" },
      "nonprod",
      { WE_MET_D1_DATABASE_ID_NONPROD: "other" },
    );
    expect(errors[0]).toContain("does not match");
  });
});
