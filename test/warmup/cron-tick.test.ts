import { describe, expect, it, vi } from "vitest";
import { runWarmupCronTick } from "../../workers/warmup/lib/cron-tick";
import type { WarmupEnv } from "../../workers/warmup/lib/config";
import { warmupKvEnabled } from "./memory-kv";

describe("warmup cron tick (unit)", () => {
  it("sends nothing when secrets are missing", async () => {
    const send = vi.fn();
    const env: WarmupEnv = {
      EMAIL: { send },
    };
    const result = await runWarmupCronTick(env, { unit: () => 0 });
    expect(result.action).toBe("skipped_missing_secrets");
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a non-seed recipient when invoked via send path", async () => {
    const send = vi.fn();
    const env: WarmupEnv = {
      WARMUP_SEEDS: "seed@example.com",
      WARMUP_FROM: "warmup@mail.we-met.link",
      EMAIL: { send },
    };
    // Force send attempt with random=0 (send + first seed). Patch via direct send test file instead.
    const { sendWarmupEmail } =
      await import("../../workers/warmup/lib/send-warmup-email");
    const result = await sendWarmupEmail(
      env,
      { seeds: ["seed@example.com"], from: "from@example.com" },
      {
        to: "not-a-seed@example.com",
        subject: "x",
        text: "y",
        html: "<p>y</p>",
      },
    );
    expect(result).toEqual({ ok: false, code: "not_in_seeds" });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends when secrets exist, rate allows, and binding succeeds", async () => {
    const send = vi.fn(async () => ({ messageId: "m1" }));
    const env: WarmupEnv = {
      WARMUP_SEEDS: "seed@example.com",
      WARMUP_FROM: "warmup@mail.we-met.link",
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
    if (result.action === "sent") {
      expect(result.messageId).toBe("m1");
    }
    expect(send).toHaveBeenCalledOnce();
  });
});
