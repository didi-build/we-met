import { describe, expect, it, vi } from "vitest";
import { parseWarmupSecrets, type WarmupEnv } from "../../workers/warmup/lib/config";
import {
  nonSeedAlertDedupeKey,
  sendNonSeedEmailEventAlertOnce,
} from "../../workers/warmup/lib/email-event-alert";
import { WARMUP_FROM_DISPLAY_NAME } from "../../workers/warmup/lib/from-address";
import { sendWarmupPauseAlert } from "../../workers/warmup/lib/pause";
import { sendWarmupEmail } from "../../workers/warmup/lib/send-warmup-email";
import { warmupKvEnabled } from "./memory-kv";

const secretsEnv = {
  WARMUP_SEEDS: "seed@example.com",
  WARMUP_FROM: "warmup@mail.we-met.link",
  WARMUP_ALERT_TO: "alerts@example.com",
};

describe("warmup EMAIL.send from shape (unit)", () => {
  it("sendWarmupEmail includes a string From name", async () => {
    const send = vi.fn(async () => ({ messageId: "m1" }));
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
    };
    const secrets = parseWarmupSecrets(env);
    expect(secrets).not.toBeNull();

    await sendWarmupEmail(env, secrets!, {
      to: "seed@example.com",
      subject: "s",
      text: "t",
      html: "<p>t</p>",
    });

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { email: "warmup@mail.we-met.link", name: WARMUP_FROM_DISPLAY_NAME },
      }),
    );
  });

  it("sendWarmupPauseAlert includes a string From name", async () => {
    const send = vi.fn(async () => ({ messageId: "alert-1" }));
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
    };
    const secrets = parseWarmupSecrets(env);
    expect(secrets).not.toBeNull();

    await sendWarmupPauseAlert(
      env,
      secrets!,
      { reason: "test", at: "2026-01-01T00:00:00.000Z" },
      false,
    );

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { email: "warmup@mail.we-met.link", name: WARMUP_FROM_DISPLAY_NAME },
      }),
    );
  });

  it("sendNonSeedEmailEventAlertOnce includes a string From name", async () => {
    const send = vi.fn(async () => ({ messageId: "alert-2" }));
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };
    const secrets = parseWarmupSecrets(env);
    expect(secrets).not.toBeNull();

    await sendNonSeedEmailEventAlertOnce(env, secrets!, {
      dedupeKey: nonSeedAlertDedupeKey("msg-test"),
      eventType: "cf.email.sending.message.complained",
      recipientRedacted: "x***@example.com",
    });

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { email: "warmup@mail.we-met.link", name: WARMUP_FROM_DISPLAY_NAME },
      }),
    );
  });
});
