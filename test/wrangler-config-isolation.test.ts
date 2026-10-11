import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseJsonc } from "../scripts/lib/parse-jsonc.mjs";

const PRODUCTION_MARKERS = {
  d1: "we-met-db",
  r2: "we-met-assets",
  queue: "we-met-followup-email",
  rateLimiterNamespaceId: "2002",
};

const NONPROD_MARKERS = {
  d1: "we-met-db-nonprod",
  r2: "we-met-assets-nonprod",
  queue: "we-met-followup-email-nonprod",
  rateLimiterNamespaceId: "2001",
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

describe("wrangler config isolation (unit)", () => {
  const config = parseJsonc(readFileSync("wrangler.jsonc", "utf8")) as {
    vars?: Record<string, string>;
    d1_databases?: { database_name: string }[];
    r2_buckets?: { bucket_name: string }[];
    queues?: { producers?: { queue: string }[] };
    ratelimits?: { namespace_id: string }[];
    previews?: Record<string, unknown>;
  };

  it("uses production rate limiter namespace 2002 at top level and 2001 in previews", () => {
    expect(config.ratelimits?.[0]?.namespace_id).toBe(
      PRODUCTION_MARKERS.rateLimiterNamespaceId,
    );
    const previewLimits = config.previews?.ratelimits as
      { namespace_id: string }[] | undefined;
    expect(previewLimits?.[0]?.namespace_id).toBe(
      NONPROD_MARKERS.rateLimiterNamespaceId,
    );
    expect(config.ratelimits?.[0]?.namespace_id).not.toBe(
      previewLimits?.[0]?.namespace_id,
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
    expect(previewStrings).not.toContain(PRODUCTION_MARKERS.rateLimiterNamespaceId);
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
