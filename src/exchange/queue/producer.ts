import type { WeMetQueueMessage } from "@/exchange/queue/types";

export type FollowupEmailQueueProducer = {
  enqueueVisitorLetter(
    message: import("@/exchange/queue/types").VisitorLetterQueueMessage,
    options?: QueueSendOptions,
  ): Promise<void>;
};

export type LeadSinkQueueProducer = {
  enqueueLeadSink(
    message: Exclude<WeMetQueueMessage, { type: "visitor_followup" }>,
    options?: QueueSendOptions,
  ): Promise<void>;
};

export type QueueSendOptions = {
  delaySeconds?: number;
};

export type CloudflareQueueBinding = {
  send(message: unknown, options?: QueueSendOptions): Promise<void>;
};

export class MissingQueueBindingError extends Error {
  constructor(bindingName: string) {
    super(`Missing required queue binding: ${bindingName}`);
    this.name = "MissingQueueBindingError";
  }
}

export function requireQueueBinding(
  binding: CloudflareQueueBinding | undefined,
  bindingName: string,
): CloudflareQueueBinding {
  if (!binding) {
    throw new MissingQueueBindingError(bindingName);
  }
  return binding;
}

export function createCloudflareFollowupEmailQueueProducer(
  binding: CloudflareQueueBinding,
): FollowupEmailQueueProducer {
  return {
    async enqueueVisitorLetter(message, options) {
      await binding.send(message, options);
    },
  };
}

export function createCloudflareLeadSinkQueueProducer(
  binding: CloudflareQueueBinding,
): LeadSinkQueueProducer {
  return {
    async enqueueLeadSink(message, options) {
      await binding.send(message, options);
    },
  };
}
