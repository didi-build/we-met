import { describe, expect, it, vi } from "vitest";
import { runWarmupCronTick } from "../../workers/warmup/lib/cron-tick";
import { parseWarmupSecrets, type WarmupEnv } from "../../workers/warmup/lib/config";
import { deliverPauseAlertIfPending } from "../../workers/warmup/lib/pause";
import {
  WARMUP_KV_PAUSED,
  WARMUP_KV_PAUSED_ALERT,
  warmupPausedEpisodeId,
} from "../../workers/warmup/lib/state";
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
    expect(paused.alertSent).toBeUndefined();

    const alertRaw = await kv.get(WARMUP_KV_PAUSED_ALERT);
    expect(alertRaw).toBeTruthy();
    const alertState = JSON.parse(alertRaw!);
    expect(alertState.episode).toBe(await warmupPausedEpisodeId(pausedRaw!));
    expect(typeof alertState.sentAt).toBe("string");

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
    expect(await kv.get(WARMUP_KV_PAUSED_ALERT)).toBeNull();

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

    expect(await kv.get(WARMUP_KV_PAUSED_ALERT)).toBeTruthy();

    send.mockClear();
    await runWarmupCronTick(env, { unit: () => 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends one malformed-pause alert without rewriting the paused key", async () => {
    const malformed = "oops";
    const send = vi.fn(async (_message: { to: string; text: string }) => ({
      messageId: "alert-malformed",
    }));
    const kv = warmupKvEnabled();
    await kv.put(WARMUP_KV_PAUSED, malformed);

    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    const tick = await runWarmupCronTick(env, { unit: () => 0 });
    expect(tick.action).toBe("skipped_paused");
    expect(await kv.get(WARMUP_KV_PAUSED)).toBe(malformed);

    const alertCalls = send.mock.calls.filter(
      (call) => call[0].to === "alerts@example.com",
    );
    expect(alertCalls).toHaveLength(1);
    expect(alertCalls[0][0].text).toContain("malformed");
    expect(alertCalls[0][0].text).not.toContain(malformed);

    send.mockClear();
    await runWarmupCronTick(env, { unit: () => 0 });
    expect(send).not.toHaveBeenCalled();
    expect(await kv.get(WARMUP_KV_PAUSED)).toBe(malformed);
  });

  it("does not send again when legacy alertSent is set on paused", async () => {
    const send = vi.fn(async () => ({ messageId: "no-alert" }));
    const pausedJson = JSON.stringify({
      reason: "legacy_pause",
      at: "2020-01-01T00:00:00.000Z",
      alertSent: true,
    });
    const kv = warmupKvEnabled();
    await kv.put(WARMUP_KV_PAUSED, pausedJson);

    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    await runWarmupCronTick(env, { unit: () => 0 });
    expect(send).not.toHaveBeenCalled();
    expect(await kv.get(WARMUP_KV_PAUSED)).toBe(pausedJson);
  });

  it("sends a new alert after paused is cleared and auto-pause happens again", async () => {
    const send = vi.fn(async (message: { to: string }) => {
      if (message.to === "seed@example.com") {
        const err = new Error("suppressed");
        (err as Error & { code: string }).code = "E_RECIPIENT_SUPPRESSED";
        throw err;
      }
      return { messageId: "alert" };
    });
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T12:00:00.000Z"));
    try {
      let n = 0;
      await runWarmupCronTick(env, {
        unit: () => {
          n += 1;
          return n === 1 ? 0 : 0.1;
        },
      });
      const firstPausedRaw = await kv.get(WARMUP_KV_PAUSED);
      expect(firstPausedRaw).toBeTruthy();
      const firstEpisode = await kv.get(WARMUP_KV_PAUSED_ALERT);
      expect(firstEpisode).toBeTruthy();

      await kv.delete(WARMUP_KV_PAUSED);
      send.mockClear();
      vi.setSystemTime(new Date("2026-10-22T12:00:01.000Z"));
      n = 0;
      await runWarmupCronTick(env, {
        unit: () => {
          n += 1;
          return n === 1 ? 0 : 0.1;
        },
      });

      const secondPausedRaw = await kv.get(WARMUP_KV_PAUSED);
      expect(secondPausedRaw).toBeTruthy();
      expect(secondPausedRaw).not.toBe(firstPausedRaw);

      const secondEpisode = await kv.get(WARMUP_KV_PAUSED_ALERT);
      expect(secondEpisode).toBeTruthy();
      expect(secondEpisode).not.toBe(firstEpisode);
      const alertCalls = send.mock.calls.filter(
        (call) => call[0].to === "alerts@example.com",
      );
      expect(alertCalls).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips alert when paused_alert KV read fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const send = vi.fn(async () => ({ messageId: "alert" }));
    const base = warmupKvEnabled();
    await base.put(
      WARMUP_KV_PAUSED,
      JSON.stringify({ reason: "manual", at: "2020-01-01T00:00:00.000Z" }),
    );

    const kv = {
      ...base,
      get: async (key: string) => {
        if (key === WARMUP_KV_PAUSED_ALERT) {
          throw new Error("kv unavailable");
        }
        return base.get(key);
      },
    } as KVNamespace;

    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    const secrets = parseWarmupSecrets(env);
    expect(secrets).not.toBeNull();
    const sent = await deliverPauseAlertIfPending(env, secrets!);
    expect(sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("warmup_pause_alert_state_read_failed");
    warn.mockRestore();
  });
});
