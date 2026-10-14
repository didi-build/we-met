import {
  createFollowupConsumerDepsFromEnv,
  processFollowupQueueBatch,
  type FollowupConsumerEnv,
} from "@/followup-email-consumer/process-batch";

const followupEmailConsumer = {
  async queue(
    batch: {
      messages: Array<{
        id: string;
        attempts: number;
        body: unknown;
        ack(): void;
        retry(options?: { delaySeconds?: number }): void;
      }>;
    },
    env: FollowupConsumerEnv,
  ): Promise<void> {
    const deps = createFollowupConsumerDepsFromEnv(env);
    await processFollowupQueueBatch(batch, deps);
  },
};

export default followupEmailConsumer;
