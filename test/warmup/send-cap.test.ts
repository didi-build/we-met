import { describe, expect, it, vi } from "vitest";
import { runWarmupCronTick } from "../../workers/warmup/lib/cron-tick";
import type { WarmupEnv } from "../../workers/warmup/lib/config";
import {
  WARMUP_MAX_SENDS_PER_DAY,
  warmupCapKeysForDate,
} from "../../workers/warmup/lib/send-cap";
import { warmupKvEnabled } from "./memory-kv";

const secretsEnv = {
  WARMUP_SEEDS: "seed@example.com",
  WARMUP_FROM: "warmup@mail.we-met.link",
};

describe("warmup send cap (unit)", () => {
  it("enforces the daily hard cap in KV", async () => {
    const fixedDate = new Date("2026-10-22T12:00:00.000Z");
    const keys = warmupCapKeysForDate(fixedDate);
    const kv = warmupKvEnabled();
    await kv.put(keys.day, String(WARMUP_MAX_SENDS_PER_DAY));

    const send = vi.fn(async () => ({ messageId: "m1" }));
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
    try {
      const result = await runWarmupCronTick(env, { unit: () => 0 });
      expect(result.action).toBe("skipped_send_cap");
      expect(send).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("increments counters after a successful send", async () => {
    const fixedDate = new Date("2026-10-22T12:00:00.000Z");
    const keys = warmupCapKeysForDate(fixedDate);
    const kv = warmupKvEnabled();
    const send = vi.fn(async () => ({ messageId: "m1" }));
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
    try {
      let n = 0;
      await runWarmupCronTick(env, {
        unit: () => {
          n += 1;
          return n === 1 ? 0 : 0.1;
        },
      });
      expect(await kv.get(keys.day)).toBe("1");
      expect(await kv.get(keys.month)).toBe("1");
    } finally {
      vi.useRealTimers();
    }
  });
});
