import { runWarmupCronTick } from "./lib/cron-tick";
import { processWarmupQueueBatch } from "./lib/queue-batch";
import type { WarmupEnv, WarmupQueueBody } from "./lib/config";

const warmupWorker = {
  async scheduled(
    _controller: ScheduledController,
    env: WarmupEnv,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      runWarmupCronTick(env, {
        unit: () => Math.random(),
      }),
    );
  },

  async queue(batch: MessageBatch<WarmupQueueBody>, env: WarmupEnv): Promise<void> {
    await processWarmupQueueBatch(batch, env);
  },
};

export default warmupWorker;
