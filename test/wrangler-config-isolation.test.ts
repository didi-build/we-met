import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseJsonc } from "../scripts/lib/parse-jsonc.mjs";

const PRODUCTION_MARKERS = {
  d1: "we-met-db",
  r2: "we-met-assets",
  queue: "we-met-followup-email",
  exchangeRateLimiterNamespaceId: "2002",
  authRateLimiterNamespaceId: "2004",
  appRateLimiterNamespaceId: "2006",
};

const NONPROD_MARKERS = {
  d1: "we-met-db-nonprod",
  r2: "we-met-assets-nonprod",
  queue: "we-met-followup-email-nonprod",
  exchangeRateLimiterNamespaceId: "2001",
  authRateLimiterNamespaceId: "2003",
  appRateLimiterNamespaceId: "2005",
};

function collectPreviewStrings(previews: Record<string, unknown>): string[] {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (value === null || value === undefined) return;
    if (typeof value === "string") {
      out.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (typeof value === "object") {
      for (const v of Object.values(value as Record<string, unknown>)) walk(v);
    }
  };
  walk(previews);
  return out;
}

function namespaceByName(
  rows: { name: string; namespace_id: string }[] | undefined,
  name: string,
): string | undefined {
  return rows?.find((row) => row.name === name)?.namespace_id;
}

describe("wrangler config isolation (unit)", () => {
  const config = parseJsonc(readFileSync("wrangler.jsonc", "utf8")) as {
    vars?: Record<string, string>;
    d1_databases?: { database_name: string }[];
    r2_buckets?: { bucket_name: string }[];
    queues?: { producers?: { queue: string }[] };
    ratelimits?: { name: string; namespace_id: string }[];
    previews?: Record<string, unknown>;
  };

  it("uses distinct production and preview rate limiter namespaces per binding", () => {
    expect(namespaceByName(config.ratelimits, "WE_MET_EXCHANGE_RATE_LIMITER")).toBe(
      PRODUCTION_MARKERS.exchangeRateLimiterNamespaceId,
    );
    expect(namespaceByName(config.ratelimits, "WE_MET_AUTH_RATE_LIMITER")).toBe(
      PRODUCTION_MARKERS.authRateLimiterNamespaceId,
    );
    expect(namespaceByName(config.ratelimits, "WE_MET_APP_RATE_LIMITER")).toBe(
      PRODUCTION_MARKERS.appRateLimiterNamespaceId,
    );

    const previewLimits = config.previews?.ratelimits as
      { name: string; namespace_id: string }[] | undefined;
    expect(namespaceByName(previewLimits, "WE_MET_EXCHANGE_RATE_LIMITER")).toBe(
      NONPROD_MARKERS.exchangeRateLimiterNamespaceId,
    );
    expect(namespaceByName(previewLimits, "WE_MET_AUTH_RATE_LIMITER")).toBe(
      NONPROD_MARKERS.authRateLimiterNamespaceId,
    );
    expect(namespaceByName(previewLimits, "WE_MET_APP_RATE_LIMITER")).toBe(
      NONPROD_MARKERS.appRateLimiterNamespaceId,
    );
  });

  it("sets WE_MET_ENV for production and preview", () => {
    expect(config.vars?.WE_MET_ENV).toBe("production");
    const previewVars = config.previews?.vars as Record<string, string> | undefined;
    expect(previewVars?.WE_MET_ENV).toBe("preview");
  });

  it("keeps production resource names out of the previews block", () => {
    const previewStrings = collectPreviewStrings(config.previews ?? {});
    expect(previewStrings).not.toContain(PRODUCTION_MARKERS.d1);
    expect(previewStrings).not.toContain(PRODUCTION_MARKERS.r2);
    expect(previewStrings).not.toContain(PRODUCTION_MARKERS.queue);
    expect(previewStrings).not.toContain(
      PRODUCTION_MARKERS.exchangeRateLimiterNamespaceId,
    );
    expect(previewStrings).not.toContain(PRODUCTION_MARKERS.authRateLimiterNamespaceId);
    expect(previewStrings).not.toContain(PRODUCTION_MARKERS.appRateLimiterNamespaceId);
  });

  it("uses non-prod resource names in the previews block", () => {
    const previewD1 = config.previews?.d1_databases as
      { database_name: string }[] | undefined;
    const previewR2 = config.previews?.r2_buckets as
      { bucket_name: string }[] | undefined;
    const previewQueues = config.previews?.queues as
      { producers?: { queue: string }[] } | undefined;

    expect(previewD1?.[0]?.database_name).toBe(NONPROD_MARKERS.d1);
    expect(previewR2?.[0]?.bucket_name).toBe(NONPROD_MARKERS.r2);
    expect(previewQueues?.producers?.[0]?.queue).toBe(NONPROD_MARKERS.queue);
  });
});
