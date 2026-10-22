import { describe, expect, it, vi } from "vitest";
import { handleWarmupScheduled } from "../../workers/warmup/index";
import type { WarmupEnv } from "../../workers/warmup/lib/config";

describe("warmup scheduled handler (unit)", () => {
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
