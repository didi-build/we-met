import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseJsonc } from "../../scripts/lib/parse-jsonc.mjs";
import {
  WARMUP_RETRY_DELAY_SECONDS,
  WARMUP_RETRY_MAX_RETRIES,
} from "../../workers/warmup/lib/queue-policy";

describe("warmup wrangler config (unit)", () => {
  const config = parseJsonc(
    readFileSync("workers/warmup/wrangler.jsonc", "utf8"),
  ) as Record<string, unknown>;

  it("is a separate worker from we-met", () => {
    expect(config.name).toBe("we-met-warmup-cron");
    expect(config.main).toBe("index.ts");
  });

  it("sets hourly cron and explicit queue retry settings", () => {
    const crons = (config.triggers as { crons: string[] }).crons;
    expect(crons).toEqual(["0 * * * *"]);
    const consumer = (config.queues as { consumers: Record<string, unknown>[] })
      .consumers[0];
    expect(consumer.max_retries).toBe(WARMUP_RETRY_MAX_RETRIES);
    expect(consumer.retry_delay).toBe(WARMUP_RETRY_DELAY_SECONDS);
    expect(consumer.dead_letter_queue).toBe("we-met-warmup-send-dlq");
  });

  it("does not pin sender addresses in wrangler (WARMUP_FROM secret only)", () => {
    const sendEmail = config.send_email as Record<string, unknown>[];
    expect(sendEmail[0]).not.toHaveProperty("allowed_sender_addresses");
  });

  it("binds WARMUP_STATE KV placeholder", () => {
    const kv = (config.kv_namespaces as { binding: string; id: string }[])[0];
    expect(kv.binding).toBe("WARMUP_STATE");
    expect(kv.id).toMatch(/^0{8}-0{4}-0{4}-0{4}-0{12}$/);
  });
});
