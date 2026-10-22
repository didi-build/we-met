import {
  runWarmupCronTick,
  type CronRandom,
  type CronTickResult,
} from "./lib/cron-tick";
import { processWarmupQueueBatch } from "./lib/queue-batch";
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

const warmupWorker = {
  async scheduled(
    _controller: ScheduledController,
    env: WarmupEnv,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await handleWarmupScheduled(env);
  },

  async queue(batch: MessageBatch<WarmupQueueBody>, env: WarmupEnv): Promise<void> {
    await processWarmupQueueBatch(batch, env);
  },
};

export default warmupWorker;
