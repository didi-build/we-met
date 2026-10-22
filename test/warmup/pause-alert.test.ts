import { describe, expect, it, vi } from "vitest";
import { runWarmupCronTick } from "../../workers/warmup/lib/cron-tick";
import type { WarmupEnv } from "../../workers/warmup/lib/config";
import { WARMUP_KV_PAUSED } from "../../workers/warmup/lib/state";
import { warmupKvEnabled } from "./memory-kv";

const secretsEnv = {
  WARMUP_SEEDS: "seed@example.com",
  WARMUP_FROM: "warmup@mail.we-met.link",
  WARMUP_ALERT_TO: "alerts@example.com",
};

describe("warmup auto-pause and alert (unit)", () => {
  it("sets paused and sends exactly one alert on E_RECIPIENT_SUPPRESSED", async () => {
    const send = vi.fn(async (message: { to: string; from: { email: string } }) => {
      if (message.to === "seed@example.com") {
        const err = new Error("suppressed");
        (err as Error & { code: string }).code = "E_RECIPIENT_SUPPRESSED";
        throw err;
      }
      return { messageId: "alert-1" };
    });
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };
    let n = 0;
    await runWarmupCronTick(env, {
      unit: () => {
        n += 1;
        return n === 1 ? 0 : 0.1;
      },
    });

    const pausedRaw = await kv.get(WARMUP_KV_PAUSED);
    expect(pausedRaw).toBeTruthy();
    const paused = JSON.parse(pausedRaw!);
    expect(paused.reason).toContain("recipient_suppressed");
    expect(paused.alertSent).toBe(true);

    const alertCalls = send.mock.calls.filter(
      (call) => call[0].to === "alerts@example.com",
    );
    expect(alertCalls).toHaveLength(1);
    expect(alertCalls[0][0].from).toEqual({
      email: "warmup@mail.we-met.link",
    });

    send.mockClear();
    const second = await runWarmupCronTick(env, { unit: () => 0 });
    expect(second.action).toBe("skipped_paused");
    expect(send).not.toHaveBeenCalled();
  });

  it("retries the pause alert on later ticks until one succeeds", async () => {
    let alertAttempts = 0;
    const send = vi.fn(async (message: { to: string; from: { email: string } }) => {
      if (message.to === "seed@example.com") {
        const err = new Error("suppressed");
        (err as Error & { code: string }).code = "E_RECIPIENT_SUPPRESSED";
        throw err;
      }
      alertAttempts += 1;
      if (alertAttempts === 1) {
        throw new Error("alert transport failed");
      }
      return { messageId: "alert-ok" };
    });

    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    let n = 0;
    await runWarmupCronTick(env, {
      unit: () => {
        n += 1;
        return n === 1 ? 0 : 0.1;
      },
    });

    const afterFirst = JSON.parse((await kv.get(WARMUP_KV_PAUSED))!);
    expect(afterFirst.alertSent).toBeUndefined();

    const alertCallsAfterPause = send.mock.calls.filter(
      (call) => call[0].to === "alerts@example.com",
    );
    expect(alertCallsAfterPause).toHaveLength(1);

    send.mockClear();
    const second = await runWarmupCronTick(env, { unit: () => 0 });
    expect(second.action).toBe("skipped_paused");
    const alertCallsAfterRetry = send.mock.calls.filter(
      (call) => call[0].to === "alerts@example.com",
    );
    expect(alertCallsAfterRetry).toHaveLength(1);

    const afterRetry = JSON.parse((await kv.get(WARMUP_KV_PAUSED))!);
    expect(afterRetry.alertSent).toBe(true);

    send.mockClear();
    await runWarmupCronTick(env, { unit: () => 0 });
    expect(send).not.toHaveBeenCalled();
  });
});
