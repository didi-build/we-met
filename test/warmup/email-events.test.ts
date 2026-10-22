import { describe, expect, it, vi } from "vitest";
import { handleWarmupQueue } from "../../workers/warmup/index";
import type { WarmupEnv } from "../../workers/warmup/lib/config";
import {
  WARMUP_KV_NONSEED_ALERT_PREFIX,
  nonSeedAlertDedupeKey,
} from "../../workers/warmup/lib/email-event-alert";
import { processEmailEventsBatch } from "../../workers/warmup/lib/email-events";
import {
  WARMUP_EMAIL_EVENTS_QUEUE,
  WARMUP_EMAIL_EVENTS_QUEUE_PLACEHOLDER,
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
}): Record<string, unknown> {
  const recipient = overrides.recipient ?? "seed@example.com";
  const type = overrides.type ?? "cf.email.sending.message.complained";
  const schemaVersion = overrides.schemaVersion ?? 1;
  const body: Record<string, unknown> = {
    type,
    source: { type: "email.sending", domain: "mail.we-met.link" },
    payload: {
      eventId: "evt-00000000-0000-4000-8000-000000000001",
      messageId: "msg-00000000-0000-4000-8000-000000000002",
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

  it("routes queue batches by name and throws on unknown queue", async () => {
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

    const placeholderBatch = {
      queue: WARMUP_EMAIL_EVENTS_QUEUE_PLACEHOLDER,
      messages: [
        emailQueueMessage(
          "q2",
          baseEvent({
            type: "cf.email.sending.message.bounced",
            bounceType: "soft",
            recipient: "seed@example.com",
          }),
        ),
      ],
    };
    await handleWarmupQueue(placeholderBatch as never, env);
    expect(placeholderBatch.messages[0].ack).toHaveBeenCalled();

    await expect(
      handleWarmupQueue(
        {
          queue: "unknown-queue",
          messages: [],
        } as never,
        env,
      ),
    ).rejects.toThrow("warmup_unknown_queue:unknown-queue");

    const retryBatch = {
      queue: WARMUP_SEND_RETRY_QUEUE,
      messages: [],
    };
    await expect(handleWarmupQueue(retryBatch as never, env)).resolves.toBeUndefined();
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
