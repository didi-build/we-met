import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseJsonc } from "../scripts/lib/parse-jsonc.mjs";
import { MAX_VISITOR_FOLLOWUP_ATTEMPTS } from "../scripts/lib/queue-retry-policy.mjs";
import {
  NONPROD_RESOURCE_MARKERS,
  PRODUCTION_RESOURCE_MARKERS,
} from "../scripts/lib/wrangler-placeholders.mjs";

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (value === null || value === undefined) return out;
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return out;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>))
      collectStrings(v, out);
  }
  return out;
}

describe("follow-up email consumer wrangler configs (unit)", () => {
  const nonprod = parseJsonc(
    readFileSync(
      "workers/we-met-followup-email-consumer/wrangler.nonprod.jsonc",
      "utf8",
    ),
  ) as Record<string, unknown>;
  const production = parseJsonc(
    readFileSync(
      "workers/we-met-followup-email-consumer/wrangler.production.jsonc",
      "utf8",
    ),
  ) as Record<string, unknown>;

  it("non-prod binds only non-prod queue and bucket", () => {
    expect(nonprod.name).toBe(NONPROD_RESOURCE_MARKERS.consumerWorkerName);
    const consumers = (nonprod.queues as { consumers: { queue: string }[] }).consumers;
    expect(consumers[0].queue).toBe(NONPROD_RESOURCE_MARKERS.queue);
    const buckets = (nonprod.r2_buckets as { bucket_name: string }[])[0];
    expect(buckets.bucket_name).toBe(NONPROD_RESOURCE_MARKERS.r2Bucket);
    const strings = collectStrings(nonprod);
    expect(strings).not.toContain(PRODUCTION_RESOURCE_MARKERS.queue);
    expect(strings).not.toContain(PRODUCTION_RESOURCE_MARKERS.r2Bucket);
  });

  it("production consumer uses production bindings and WE_MET_ENV", () => {
    expect(production.name).toBe("we-met-followup-email-consumer");
    const consumers = (production.queues as { consumers: { queue: string }[] })
      .consumers;
    expect(consumers[0].queue).toBe(PRODUCTION_RESOURCE_MARKERS.queue);
    const buckets = (production.r2_buckets as { bucket_name: string }[])[0];
    expect(buckets.bucket_name).toBe(PRODUCTION_RESOURCE_MARKERS.r2Bucket);
    expect((production.vars as { WE_MET_ENV: string }).WE_MET_ENV).toBe("production");
    const strings = collectStrings(production);
    expect(strings).not.toContain("WE_MET_TEST_MAIL_TO");
    expect(strings).not.toContain(NONPROD_RESOURCE_MARKERS.queue);
  });

  it("allows only WE_MET_ENV in consumer vars", () => {
    expect(Object.keys(nonprod.vars as object).sort()).toEqual(["WE_MET_ENV"]);
    expect(Object.keys(production.vars as object).sort()).toEqual(["WE_MET_ENV"]);
  });

  it("sets max_retries on queue consumers to match the shared attempt limit", () => {
    const nonprodConsumer = (nonprod.queues as { consumers: { max_retries: number }[] })
      .consumers[0];
    const prodConsumer = (production.queues as { consumers: { max_retries: number }[] })
      .consumers[0];
    expect(nonprodConsumer.max_retries).toBe(MAX_VISITOR_FOLLOWUP_ATTEMPTS);
    expect(prodConsumer.max_retries).toBe(MAX_VISITOR_FOLLOWUP_ATTEMPTS);
  });

  it("disables workers.dev and Version URLs on both consumer configs", () => {
    expect(nonprod.workers_dev).toBe(false);
    expect(nonprod.preview_urls).toBe(false);
    expect(production.workers_dev).toBe(false);
    expect(production.preview_urls).toBe(false);
  });

  it("binds WE_MET_DB to the environment database name", () => {
    const nonprodD1 = (
      nonprod.d1_databases as { binding: string; database_name: string }[]
    )[0];
    const prodD1 = (
      production.d1_databases as { binding: string; database_name: string }[]
    )[0];
    expect(nonprodD1.binding).toBe("WE_MET_DB");
    expect(nonprodD1.database_name).toBe(NONPROD_RESOURCE_MARKERS.d1Name);
    expect(prodD1.binding).toBe("WE_MET_DB");
    expect(prodD1.database_name).toBe(PRODUCTION_RESOURCE_MARKERS.d1Name);
  });
});
