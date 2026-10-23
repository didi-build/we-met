import { describe, expect, it, vi } from "vitest";
import { handleWarmupQueue } from "../../workers/warmup/index";
import {
  WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR_DEFAULT,
  type WarmupEnv,
} from "../../workers/warmup/lib/config";
import {
  WARMUP_KV_NONSEED_ALERT_PREFIX,
  nonSeedAlertDedupeKey,
  sendNonSeedEmailEventAlertOnce,
} from "../../workers/warmup/lib/email-event-alert";
import {
  WARMUP_KV_NONSEED_ALERT_WINDOW,
  WARMUP_NONSEED_ALERT_WINDOW_MS,
} from "../../workers/warmup/lib/nonseed-alert-rate";
import { parseWarmupSecrets } from "../../workers/warmup/lib/config";
import { processEmailEventsBatch } from "../../workers/warmup/lib/email-events";
import {
  WARMUP_EMAIL_EVENTS_QUEUE,
  WARMUP_SEND_RETRY_QUEUE,
} from "../../workers/warmup/lib/queue-names";
import {
  WARMUP_KV_PAUSED,
  WARMUP_KV_PAUSED_ALERT,
} from "../../workers/warmup/lib/state";
import { WARMUP_PAUSE_REASON_ASYNC_COMPLAINT } from "../../workers/warmup/lib/send-error";
import { warmupKvEnabled } from "./memory-kv";

const secretsEnv = {
  WARMUP_SEEDS: "seed@example.com",
  WARMUP_FROM: "warmup@mail.we-met.link",
  WARMUP_ALERT_TO: "alerts@example.com",
};

function baseEvent(overrides: {
  type?: string;
  recipient?: string;
  bounceType?: string;
  schemaVersion?: number;
  messageId?: string;
}): Record<string, unknown> {
  const recipient = overrides.recipient ?? "seed@example.com";
  const type = overrides.type ?? "cf.email.sending.message.complained";
  const schemaVersion = overrides.schemaVersion ?? 1;
  const body: Record<string, unknown> = {
    type,
    source: { type: "email.sending", domain: "mail.we-met.link" },
    payload: {
      eventId: "evt-00000000-0000-4000-8000-000000000001",
      messageId: overrides.messageId ?? "msg-00000000-0000-4000-8000-000000000002",
      recipient,
      subject: "test",
      terminal: true,
    },
    metadata: {
      eventSchemaVersion: schemaVersion,
      eventTimestamp: "2026-10-22T12:00:00.000Z",
    },
  };
  if (type === "cf.email.sending.message.bounced") {
    (body.payload as Record<string, unknown>).bounce = {
      type: overrides.bounceType ?? "hard",
    };
  }
  return body;
}

function kvWithFailingWindowPut(base: KVNamespace): KVNamespace {
  return {
    ...base,
    put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
      if (key === WARMUP_KV_NONSEED_ALERT_WINDOW) {
        throw new Error("kv_rate_limited");
      }
      return base.put(key, value, options);
    },
  } as KVNamespace;
}

function emailQueueMessage(
  id: string,
  body: unknown,
): {
  id: string;
  body: unknown;
  ack: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
} {
  return {
    id,
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

describe("warmup email events (unit)", () => {
  it("pauses on seed complaint with async_complaint and sends one pause alert", async () => {
    const send = vi.fn(async (_message: { to: string }) => ({ messageId: "alert-1" }));
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    const message = emailQueueMessage("q1", baseEvent({}));
    await processEmailEventsBatch({ messages: [message] }, env);

    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();

    const paused = JSON.parse((await kv.get(WARMUP_KV_PAUSED))!);
    expect(paused.reason).toBe(WARMUP_PAUSE_REASON_ASYNC_COMPLAINT);
    expect(await kv.get(WARMUP_KV_PAUSED_ALERT)).toBeTruthy();
    const alertCalls = send.mock.calls.filter(
      (call) => call[0].to === "alerts@example.com",
    );
    expect(alertCalls).toHaveLength(1);
  });

  it("pauses on seed hard bounce and not on soft bounce", async () => {
    const send = vi.fn(async (_message: { to: string }) => ({ messageId: "alert" }));
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    const hard = emailQueueMessage(
      "hard",
      baseEvent({
        type: "cf.email.sending.message.bounced",
        bounceType: "hard",
      }),
    );
    await processEmailEventsBatch({ messages: [hard] }, env);
    expect(hard.ack).toHaveBeenCalledOnce();
    const pausedAfterHard = await kv.get(WARMUP_KV_PAUSED);
    expect(pausedAfterHard).toBeTruthy();

    await kv.delete(WARMUP_KV_PAUSED);
    await kv.delete(WARMUP_KV_PAUSED_ALERT);

    const soft = emailQueueMessage(
      "soft",
      baseEvent({
        type: "cf.email.sending.message.bounced",
        bounceType: "soft",
        recipient: "seed@example.com",
      }),
    );
    await processEmailEventsBatch({ messages: [soft] }, env);
    expect(soft.ack).toHaveBeenCalledOnce();
    expect(await kv.get(WARMUP_KV_PAUSED)).toBeNull();
  });

  it("alerts but does not pause for non-seed hard bounce, with dedupe per message id", async () => {
    const send = vi.fn(async (_message: { to: string }) => ({ messageId: "alert" }));
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    const body = baseEvent({
      type: "cf.email.sending.message.bounced",
      bounceType: "hard",
      recipient: "app-user@example.com",
    });
    const first = emailQueueMessage("q1", body);
    const second = emailQueueMessage("q2", body);

    await processEmailEventsBatch({ messages: [first] }, env);
    await processEmailEventsBatch({ messages: [second] }, env);

    expect(await kv.get(WARMUP_KV_PAUSED)).toBeNull();
    const alertCalls = send.mock.calls.filter(
      (call) => call[0].to === "alerts@example.com",
    );
    expect(alertCalls).toHaveLength(1);
    expect(
      await kv.get(nonSeedAlertDedupeKey("msg-00000000-0000-4000-8000-000000000002")),
    ).toBeTruthy();
  });

  it("never logs full recipient addresses", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const send = vi.fn(async (_message: { to: string }) => ({ messageId: "alert" }));
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    const message = emailQueueMessage(
      "q1",
      baseEvent({
        type: "cf.email.sending.message.bounced",
        bounceType: "soft",
        recipient: "longlocalpart@example.com",
      }),
    );
    await processEmailEventsBatch({ messages: [message] }, env);

    const joined = logSpy.mock.calls.map((call) => JSON.stringify(call)).join("\n");
    expect(joined).not.toContain("longlocalpart@example.com");
    expect(joined).toContain("l***@example.com");
    logSpy.mockRestore();
  });

  it("retries malformed events and unsupported schema versions", async () => {
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send: vi.fn() },
      WARMUP_STATE: kv,
    };

    const malformed = emailQueueMessage("bad", { not: "an event" });
    const wrongVersion = emailQueueMessage("ver", baseEvent({ schemaVersion: 2 }));

    await processEmailEventsBatch({ messages: [malformed, wrongVersion] }, env);

    expect(malformed.retry).toHaveBeenCalledOnce();
    expect(malformed.ack).not.toHaveBeenCalled();
    expect(wrongVersion.retry).toHaveBeenCalledOnce();
    expect(wrongVersion.ack).not.toHaveBeenCalled();
  });

  it("retries when secrets or KV are missing", async () => {
    const message = emailQueueMessage("q1", baseEvent({}));
    await processEmailEventsBatch({ messages: [message] }, {});
    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
  });

  it("escapes event-derived values in non-seed alert HTML", async () => {
    const send = vi.fn(async (message: { to: string; html: string; text: string }) => {
      expect(message.html).not.toContain("<script>");
      expect(message.html).toContain(
        "cf.email.sending.message.complained&quot;&gt;&lt;img",
      );
      expect(message.html).toContain("&lt;script&gt;evil&lt;/script&gt;");
      expect(message.html).toContain("x&lt;script&gt;@example.com");
      expect(message.text).toContain('complained"><img');
      return { messageId: "alert" };
    });
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };
    const secrets = parseWarmupSecrets(env);
    expect(secrets).not.toBeNull();

    const sent = await sendNonSeedEmailEventAlertOnce(env, secrets!, {
      dedupeKey: nonSeedAlertDedupeKey("<script>evil</script>"),
      eventType: 'cf.email.sending.message.complained"><img src=x onerror=alert(1)>',
      recipientRedacted: "x<script>@example.com",
    });
    expect(sent).toBe("sent_individual");
    expect(send).toHaveBeenCalledOnce();
  });

  it("routes configured queue names and acks unknown queues", async () => {
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: {
        send: vi.fn(async (_message: { to: string }) => ({ messageId: "a" })),
      },
      WARMUP_STATE: kv,
    };

    const batch = {
      queue: WARMUP_EMAIL_EVENTS_QUEUE,
      messages: [
        emailQueueMessage(
          "q1",
          baseEvent({
            type: "cf.email.sending.message.bounced",
            bounceType: "soft",
            recipient: "seed@example.com",
          }),
        ),
      ],
    };
    await handleWarmupQueue(batch as never, env);
    expect(batch.messages[0].ack).toHaveBeenCalled();

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unknownMessage = emailQueueMessage("unk", baseEvent({}));
    const unknownBatch = {
      queue: "unknown-queue",
      messages: [unknownMessage],
    };
    await handleWarmupQueue(unknownBatch as never, env);
    expect(warn).toHaveBeenCalledWith(
      "warmup_unknown_queue",
      expect.objectContaining({ queue: "unknown-queue", messageCount: 1 }),
    );
    expect(unknownMessage.ack).toHaveBeenCalledOnce();
    warn.mockRestore();

    const retryBatch = {
      queue: WARMUP_SEND_RETRY_QUEUE,
      messages: [],
    };
    await expect(handleWarmupQueue(retryBatch as never, env)).resolves.toBeUndefined();
  });

  it("rate-caps non-seed alerts with a summary then silence until the window resets", async () => {
    const send = vi.fn(async (_message: { subject: string }) => ({
      messageId: "alert",
    }));
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    const fixedStart = new Date("2026-10-22T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(fixedStart);
    try {
      const cap = WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR_DEFAULT;
      const messages = Array.from({ length: cap + 3 }, (_, index) =>
        emailQueueMessage(
          `q${index}`,
          baseEvent({
            type: "cf.email.sending.message.complained",
            recipient: `user${index}@example.com`,
            messageId: `msg-cap-${index}`,
          }),
        ),
      );

      for (const message of messages) {
        await processEmailEventsBatch({ messages: [message] }, env);
        expect(message.ack).toHaveBeenCalledOnce();
      }

      const alertCalls = send.mock.calls.map((call) => call[0] as { subject: string });
      const individual = alertCalls.filter(
        (m) => m.subject === "We Met urgent: app mail bounce or complaint",
      );
      const summary = alertCalls.filter((m) => m.subject.includes("alert rate limit"));
      expect(individual).toHaveLength(cap);
      expect(summary).toHaveLength(1);
      expect(alertCalls).toHaveLength(cap + 1);

      const windowRaw = await kv.get(WARMUP_KV_NONSEED_ALERT_WINDOW);
      expect(windowRaw).toBeTruthy();
      const window = JSON.parse(windowRaw!) as {
        summarySent: boolean;
        suppressedCount: number;
        individualAlertAtMs: number[];
      };
      expect(window.summarySent).toBe(true);
      expect(window.suppressedCount).toBe(3);
      expect(window.individualAlertAtMs).toHaveLength(cap);

      vi.setSystemTime(
        new Date(fixedStart.getTime() + WARMUP_NONSEED_ALERT_WINDOW_MS + 1),
      );
      const afterReset = emailQueueMessage(
        "after-reset",
        baseEvent({
          type: "cf.email.sending.message.complained",
          recipient: "fresh@example.com",
          messageId: "msg-after-reset",
        }),
      );
      await processEmailEventsBatch({ messages: [afterReset] }, env);
      expect(afterReset.ack).toHaveBeenCalledOnce();

      const afterSubjects = send.mock.calls.map(
        (call) => (call[0] as { subject: string }).subject,
      );
      expect(
        afterSubjects.filter(
          (s) => s === "We Met urgent: app mail bounce or complaint",
        ),
      ).toHaveLength(cap + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("respects WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR when set to 2", async () => {
    const send = vi.fn(async (_message: { subject: string }) => ({
      messageId: "alert",
    }));
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR: "2",
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    for (let index = 0; index < 3; index += 1) {
      const message = emailQueueMessage(
        `cap2-${index}`,
        baseEvent({
          recipient: `cap2-${index}@example.com`,
          messageId: `msg-cap2-${index}`,
        }),
      );
      await processEmailEventsBatch({ messages: [message] }, env);
      expect(message.ack).toHaveBeenCalledOnce();
    }

    const subjects = send.mock.calls.map(
      (call) => (call[0] as { subject: string }).subject,
    );
    expect(
      subjects.filter((s) => s === "We Met urgent: app mail bounce or complaint"),
    ).toHaveLength(2);
    expect(subjects.filter((s) => s.includes("alert rate limit"))).toHaveLength(1);
  });

  it("acks and dedupes when the window KV write fails after a successful send", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi.fn(async (_message: { subject: string }) => ({
      messageId: "alert",
    }));
    const baseKv = warmupKvEnabled();
    const kv = kvWithFailingWindowPut(baseKv);
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    const message = emailQueueMessage(
      "window-fail",
      baseEvent({
        recipient: "window-fail@example.com",
        messageId: "msg-window-fail",
      }),
    );
    await processEmailEventsBatch({ messages: [message] }, env);

    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledOnce();
    expect(await kv.get(nonSeedAlertDedupeKey("msg-window-fail"))).toBeTruthy();
    expect(errorLog).toHaveBeenCalledWith(
      "warmup_email_event_alert_window_write_failed",
      expect.objectContaining({ scope: "batch" }),
    );
    errorLog.mockRestore();
  });

  it("still pauses on seed complaint after non-seed cap without touching the window key", async () => {
    const send = vi.fn(async (_message: { subject: string }) => ({
      messageId: "alert",
    }));
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    const cap = WARMUP_NONSEED_ALERT_MAX_INDIVIDUAL_PER_HOUR_DEFAULT;
    for (let index = 0; index < cap + 1; index += 1) {
      const message = emailQueueMessage(
        `ns-${index}`,
        baseEvent({
          recipient: `ns-${index}@example.com`,
          messageId: `msg-ns-${index}`,
        }),
      );
      await processEmailEventsBatch({ messages: [message] }, env);
    }

    const windowBefore = await kv.get(WARMUP_KV_NONSEED_ALERT_WINDOW);
    expect(windowBefore).toBeTruthy();

    const seedMessage = emailQueueMessage("seed-after-cap", baseEvent({}));
    await processEmailEventsBatch({ messages: [seedMessage] }, env);
    expect(seedMessage.ack).toHaveBeenCalledOnce();

    expect(await kv.get(WARMUP_KV_NONSEED_ALERT_WINDOW)).toBe(windowBefore);
    expect(await kv.get(WARMUP_KV_PAUSED)).toBeTruthy();
    const pauseAlerts = send.mock.calls.filter(
      (call) =>
        (call[0] as { subject: string }).subject !==
          "We Met urgent: app mail bounce or complaint" &&
        !(call[0] as { subject: string }).subject.includes("alert rate limit"),
    );
    expect(pauseAlerts.length).toBeGreaterThanOrEqual(1);
  });

  it("stores non-seed dedupe keys separate from pause episode keys", async () => {
    const send = vi.fn(async (_message: { to: string }) => ({ messageId: "alert" }));
    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };
    const message = emailQueueMessage(
      "q1",
      baseEvent({
        recipient: "other@example.com",
      }),
    );
    await processEmailEventsBatch({ messages: [message] }, env);
    const dedupeKey = `${WARMUP_KV_NONSEED_ALERT_PREFIX}msg-00000000-0000-4000-8000-000000000002`;
    expect(await kv.get(dedupeKey)).toBeTruthy();
    expect(await kv.get(WARMUP_KV_PAUSED_ALERT)).toBeNull();
  });
});
