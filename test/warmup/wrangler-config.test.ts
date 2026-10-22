import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseJsonc } from "../../scripts/lib/parse-jsonc.mjs";
import {
  WARMUP_EMAIL_EVENTS_DLQ,
  WARMUP_EMAIL_EVENTS_MAX_BATCH_SIZE,
  WARMUP_EMAIL_EVENTS_MAX_RETRIES,
  WARMUP_EMAIL_EVENTS_QUEUE,
} from "../../workers/warmup/lib/queue-names";
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
    const consumers = (config.queues as { consumers: Record<string, unknown>[] })
      .consumers;
    const retryConsumer = consumers.find(
      (row) => row.queue === "we-met-warmup-send-retry",
    );
    expect(retryConsumer).toBeTruthy();
    expect(retryConsumer!.max_retries).toBe(WARMUP_RETRY_MAX_RETRIES);
    expect(retryConsumer!.retry_delay).toBe(WARMUP_RETRY_DELAY_SECONDS);
    expect(retryConsumer!.dead_letter_queue).toBe("we-met-warmup-send-dlq");

    const emailEventsConsumer = consumers.find(
      (row) => row.queue === WARMUP_EMAIL_EVENTS_QUEUE,
    );
    expect(emailEventsConsumer).toBeTruthy();
    expect(emailEventsConsumer!.max_retries).toBe(WARMUP_EMAIL_EVENTS_MAX_RETRIES);
    expect(emailEventsConsumer!.max_batch_size).toBe(
      WARMUP_EMAIL_EVENTS_MAX_BATCH_SIZE,
    );
    expect(emailEventsConsumer!.dead_letter_queue).toBe(WARMUP_EMAIL_EVENTS_DLQ);
  });

  it("does not pin sender addresses in wrangler (WARMUP_FROM secret only)", () => {
    const sendEmail = config.send_email as Record<string, unknown>[];
    expect(sendEmail[0]).not.toHaveProperty("allowed_sender_addresses");
  });

  it("binds production WARMUP_STATE KV namespace id", () => {
    const kv = (config.kv_namespaces as { binding: string; id: string }[])[0];
    expect(kv.binding).toBe("WARMUP_STATE");
    expect(kv.id).toBe("eb24ad76e95b4120ab6cdb9c6ba2fb46");
  });
});
