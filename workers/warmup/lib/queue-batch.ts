import { sendToDlqIfAllowed } from "./dlq";
import { parseWarmupSecrets, type WarmupEnv, type WarmupQueueBody } from "./config";
import { handleWarmupSendResult } from "./send-outcome";
import { checkWarmupSendCap } from "./send-cap";
import { redactEmailForLog } from "./redact-email";
import { sendWarmupEmail } from "./send-warmup-email";
import { checkWarmupSendGate } from "./state";

export type WarmupQueueMessage = {
  id: string;
  attempts: number;
  body: WarmupQueueBody;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
};

export async function processWarmupQueueBatch(
  batch: { messages: readonly WarmupQueueMessage[] },
  env: WarmupEnv,
): Promise<void> {
  const secrets = parseWarmupSecrets(env);
  if (!secrets) {
    for (const message of batch.messages) {
      console.warn("warmup_queue_skip", {
        messageId: message.id,
        reason: "missing_secrets",
      });
      message.ack();
    }
    return;
  }

  const gate = await checkWarmupSendGate(env);
  if (!gate.ok) {
    for (const message of batch.messages) {
      console.warn("warmup_queue_skip", {
        messageId: message.id,
        reason: gate.reason,
      });
      message.ack();
    }
    return;
  }

  for (const message of batch.messages) {
    const body = message.body;
    const cap = await checkWarmupSendCap(env);
    if (!cap.ok) {
      console.warn("warmup_queue_skip", {
        messageId: message.id,
        reason: "send_cap",
      });
      message.ack();
      continue;
    }

    const result = await sendWarmupEmail(env, secrets, {
      to: body.to,
      subject: body.subject,
      text: body.text,
      html: body.html,
    });

    await handleWarmupSendResult(env, secrets, result);

    if (result.ok) {
      message.ack();
      continue;
    }

    if (result.code === "not_in_seeds") {
      await sendToDlqIfAllowed(env, {
        reason: "not_in_seeds",
        toRedacted: redactEmailForLog(body.to),
        at: new Date().toISOString(),
      });
      message.ack();
      continue;
    }

    if (result.code === "send_failed") {
      message.retry();
      continue;
    }

    message.ack();
  }
}
