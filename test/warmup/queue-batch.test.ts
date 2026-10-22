import { describe, expect, it, vi } from "vitest";
import type { WarmupEnv } from "../../workers/warmup/lib/config";
import { processWarmupQueueBatch } from "../../workers/warmup/lib/queue-batch";
import { warmupKvEnabled } from "./memory-kv";

const secretsEnv = {
  WARMUP_SEEDS: "seed@example.com",
  WARMUP_FROM: "warmup@mail.we-met.link",
};

function queueMessage(
  id: string,
  to: string = "seed@example.com",
): {
  id: string;
  attempts: number;
  body: {
    to: string;
    subject: string;
    text: string;
    html: string;
    attempt: number;
  };
  ack: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
} {
  return {
    id,
    attempts: 1,
    body: {
      to,
      subject: "s",
      text: "t",
      html: "<p>t</p>",
      attempt: 1,
    },
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

describe("warmup queue batch (unit)", () => {
  it("acks later messages without sending after auto-pause on an earlier message", async () => {
    let seedSendCount = 0;
    const send = vi.fn(async (message: { to: string }) => {
      if (message.to === "seed@example.com") {
        seedSendCount += 1;
        if (seedSendCount === 1) {
          const err = new Error("suppressed");
          (err as Error & { code: string }).code = "E_RECIPIENT_SUPPRESSED";
          throw err;
        }
        return { messageId: "unexpected" };
      }
      return { messageId: "alert" };
    });

    const kv = warmupKvEnabled();
    const env: WarmupEnv = {
      ...secretsEnv,
      EMAIL: { send },
      WARMUP_STATE: kv,
    };

    const m1 = queueMessage("m1");
    const m2 = queueMessage("m2");
    const m3 = queueMessage("m3");

    await processWarmupQueueBatch({ messages: [m1, m2, m3] }, env);

    expect(seedSendCount).toBe(1);
    expect(m1.ack).toHaveBeenCalledOnce();
    expect(m2.ack).toHaveBeenCalledOnce();
    expect(m3.ack).toHaveBeenCalledOnce();
    expect(m2.retry).not.toHaveBeenCalled();
    expect(m3.retry).not.toHaveBeenCalled();
  });
});
