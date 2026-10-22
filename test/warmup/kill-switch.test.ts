import { describe, expect, it, vi } from "vitest";
import { runWarmupCronTick } from "../../workers/warmup/lib/cron-tick";
import type { WarmupEnv } from "../../workers/warmup/lib/config";
import { createMemoryKv, warmupKvEnabled } from "./memory-kv";

const secretsEnv = {
  WARMUP_SEEDS: "seed@example.com",
  WARMUP_FROM: "warmup@mail.we-met.link",
};

describe("warmup kill switch (unit)", () => {
  it("stops sends on the next tick when enabled is not true", async () => {
    const send = vi.fn();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: createMemoryKv(),
    };
    const result = await runWarmupCronTick(env, { unit: () => 0 });
    expect(result.action).toBe("skipped_disabled");
    expect(send).not.toHaveBeenCalled();
  });

  it("stops sends when enabled is false", async () => {
    const send = vi.fn();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: createMemoryKv({ enabled: "false" }),
    };
    const result = await runWarmupCronTick(env, { unit: () => 0 });
    expect(result.action).toBe("skipped_disabled");
    expect(send).not.toHaveBeenCalled();
  });

  it("sends when enabled is true and other gates pass", async () => {
    const send = vi.fn(async () => ({ messageId: "m1" }));
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: warmupKvEnabled(),
    };
    let n = 0;
    const result = await runWarmupCronTick(env, {
      unit: () => {
        n += 1;
        return n === 1 ? 0 : 0.1;
      },
    });
    expect(result.action).toBe("sent");
    expect(send).toHaveBeenCalledOnce();
  });

  it("stops on the next tick when enabled flips from true to false on the same KV", async () => {
    const send = vi.fn(async () => ({ messageId: "m1" }));
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    let n = 0;
    const first = await runWarmupCronTick(env, {
      unit: () => {
        n += 1;
        return n === 1 ? 0 : 0.1;
      },
    });
    expect(first.action).toBe("sent");
    expect(send).toHaveBeenCalledOnce();

    await kv.put("enabled", "false");
    send.mockClear();

    const second = await runWarmupCronTick(env, { unit: () => 0 });
    expect(second.action).toBe("skipped_disabled");
    expect(send).not.toHaveBeenCalled();
  });
});
