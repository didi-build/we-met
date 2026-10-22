import { buildWarmupContent, pickSeedRecipient } from "./content";
import { parseWarmupSecrets, type WarmupEnv, type WarmupQueueBody } from "./config";
import { shouldSendThisTick } from "./rate";
import { checkWarmupSendCap } from "./send-cap";
import { handleWarmupSendResult } from "./send-outcome";
import { sendWarmupEmail } from "./send-warmup-email";
import { checkWarmupSendGate } from "./state";

export type CronRandom = {
  /** Uniform [0, 1). */
  unit: () => number;
};

export type CronTickResult =
  | { action: "skipped_missing_secrets" }
  | { action: "skipped_disabled" }
  | { action: "skipped_paused" }
  | { action: "skipped_send_cap" }
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

  const gate = await checkWarmupSendGate(env);
  if (!gate.ok) {
    if (gate.reason === "paused") {
      return { action: "skipped_paused" };
    }
    return { action: "skipped_disabled" };
  }

  const cap = await checkWarmupSendCap(env);
  if (!cap.ok) {
    return { action: "skipped_send_cap" };
  }

  if (!shouldSendThisTick(random.unit())) {
    return { action: "skipped_rate" };
  }

  const recipient = pickSeedRecipient(secrets.seeds, random.unit());
  const content = buildWarmupContent(random.unit(), random.unit(), random.unit());
  const sendResult = await sendWarmupEmail(env, secrets, {
    to: recipient,
    ...content,
  });

  await handleWarmupSendResult(env, secrets, sendResult);

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
