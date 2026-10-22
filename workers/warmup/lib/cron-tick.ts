import { buildWarmupContent, pickSeedRecipient } from "./content";
import { parseWarmupSecrets, type WarmupEnv, type WarmupQueueBody } from "./config";
import { shouldSendThisTick } from "./rate";
import { sendWarmupEmail } from "./send-warmup-email";

export type CronRandom = {
  /** Uniform [0, 1). */
  unit: () => number;
};

export type CronTickResult =
  | { action: "skipped_missing_secrets" }
  | { action: "skipped_rate" }
  | { action: "sent"; messageId: string }
  | { action: "send_failed"; enqueuedRetry: boolean };

export async function runWarmupCronTick(
  env: WarmupEnv,
  random: CronRandom,
): Promise<CronTickResult> {
  const secrets = parseWarmupSecrets(env);
  if (!secrets) {
    return { action: "skipped_missing_secrets" };
  }

  if (!shouldSendThisTick(random.unit())) {
    return { action: "skipped_rate" };
  }

  const recipient = pickSeedRecipient(secrets.seeds, random.unit());
  const content = buildWarmupContent(random.unit(), random.unit());
  const sendResult = await sendWarmupEmail(env, secrets, {
    to: recipient,
    ...content,
  });

  if (sendResult.ok) {
    return { action: "sent", messageId: sendResult.messageId };
  }

  if (sendResult.code === "send_failed" && env.WARMUP_SEND_QUEUE) {
    const body: WarmupQueueBody = {
      to: recipient,
      subject: content.subject,
      text: content.text,
      html: content.html,
      attempt: 1,
    };
    await env.WARMUP_SEND_QUEUE.send(body);
    return { action: "send_failed", enqueuedRetry: true };
  }

  return { action: "send_failed", enqueuedRetry: false };
}
