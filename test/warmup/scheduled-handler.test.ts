import { describe, expect, it, vi } from "vitest";
import { handleWarmupScheduled } from "../../workers/warmup/index";
import type { WarmupEnv } from "../../workers/warmup/lib/config";
import { warmupKvEnabled } from "./memory-kv";

describe("warmup scheduled handler (unit)", () => {
  it("logs a result line for every successful cron tick", async () => {
    const env: WarmupEnv = {
      WARMUP_SEEDS: "seed@example.com",
      WARMUP_FROM: "warmup@mail.we-met.link",
      EMAIL: {
        send: vi.fn(async () => ({ messageId: "m1" })),
      },
      WARMUP_STATE: warmupKvEnabled(),
    };
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await handleWarmupScheduled(env, { unit: () => 0 });

    expect(log).toHaveBeenCalledWith(
      "warmup_scheduled_result",
      expect.objectContaining({ action: "sent", messageId: "m1" }),
    );
    log.mockRestore();
  });

  it("logs and rethrows when the cron tick throws", async () => {
    const env: WarmupEnv = {
      WARMUP_SEEDS: "seed@example.com",
      WARMUP_FROM: "warmup@mail.we-met.link",
      EMAIL: {
        send: vi.fn(async () => {
          throw new Error("send_failed");
        }),
      },
      WARMUP_SEND_QUEUE: {
        send: vi.fn(async () => {
          throw new Error("queue down");
        }),
      } as never,
      WARMUP_STATE: warmupKvEnabled(),
    };

    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(handleWarmupScheduled(env, { unit: () => 0 })).rejects.toThrow(
      "queue down",
    );

    expect(errorLog).toHaveBeenCalledWith(
      "warmup_scheduled_failed",
      expect.objectContaining({ error: "queue down" }),
    );
    errorLog.mockRestore();
  });
});
