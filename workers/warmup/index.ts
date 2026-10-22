import {
  runWarmupCronTick,
  type CronRandom,
  type CronTickResult,
} from "./lib/cron-tick";
import { processEmailEventsBatch } from "./lib/email-events";
import { processWarmupQueueBatch } from "./lib/queue-batch";
import {
  WARMUP_EMAIL_EVENTS_QUEUE,
  WARMUP_EMAIL_EVENTS_QUEUE_PLACEHOLDER,
  WARMUP_SEND_RETRY_QUEUE,
} from "./lib/queue-names";
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

export async function handleWarmupQueue(
  batch: MessageBatch<WarmupQueueBody | unknown>,
  env: WarmupEnv,
): Promise<void> {
  const queueName = batch.queue;
  if (queueName === WARMUP_SEND_RETRY_QUEUE) {
    await processWarmupQueueBatch(batch as MessageBatch<WarmupQueueBody>, env);
    return;
  }
  if (
    queueName === WARMUP_EMAIL_EVENTS_QUEUE ||
    queueName === WARMUP_EMAIL_EVENTS_QUEUE_PLACEHOLDER
  ) {
    await processEmailEventsBatch(batch as MessageBatch<unknown>, env);
    return;
  }
  throw new Error(`warmup_unknown_queue:${queueName}`);
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
