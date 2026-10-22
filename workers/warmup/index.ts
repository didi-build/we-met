import {
  runWarmupCronTick,
  type CronRandom,
  type CronTickResult,
} from "./lib/cron-tick";
import { processEmailEventsBatch } from "./lib/email-events";
import { processWarmupQueueBatch } from "./lib/queue-batch";
import { WARMUP_EMAIL_EVENTS_QUEUE, WARMUP_SEND_RETRY_QUEUE } from "./lib/queue-names";
import type { WarmupEnv, WarmupQueueBody } from "./lib/config";

export async function executeWarmupScheduled(
  env: WarmupEnv,
  random: CronRandom,
): Promise<CronTickResult> {
  return runWarmupCronTick(env, random);
}

export async function handleWarmupScheduled(
  env: WarmupEnv,
  random: CronRandom = { unit: () => Math.random() },
): Promise<void> {
  try {
    await executeWarmupScheduled(env, random);
  } catch (error) {
    console.error("warmup_scheduled_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}

function ackUnknownQueueBatch(
  batch: MessageBatch<WarmupQueueBody | unknown>,
  queueName: string,
): void {
  console.warn("warmup_unknown_queue", {
    queue: queueName,
    messageCount: batch.messages.length,
  });
  for (const message of batch.messages) {
    message.ack();
  }
}

export async function handleWarmupQueue(
  batch: MessageBatch<WarmupQueueBody | unknown>,
  env: WarmupEnv,
): Promise<void> {
  const queueName = batch.queue;
  if (queueName === WARMUP_SEND_RETRY_QUEUE) {
    await processWarmupQueueBatch(batch as MessageBatch<WarmupQueueBody>, env);
    return;
  }
  if (queueName === WARMUP_EMAIL_EVENTS_QUEUE) {
    await processEmailEventsBatch(batch as MessageBatch<unknown>, env);
    return;
  }
  ackUnknownQueueBatch(batch, queueName);
}

const warmupWorker = {
  async scheduled(
    _controller: ScheduledController,
    env: WarmupEnv,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await handleWarmupScheduled(env);
  },

  async queue(
    batch: MessageBatch<WarmupQueueBody | unknown>,
    env: WarmupEnv,
  ): Promise<void> {
    await handleWarmupQueue(batch, env);
  },
};

export default warmupWorker;
