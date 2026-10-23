import { sendToDlqIfAllowed } from "./dlq";
import { parseWarmupSecrets, type WarmupEnv, type WarmupQueueBody } from "./config";
import { deliverPauseAlertIfPending } from "./pause";
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

function ackMessagesWithoutSend(
  messages: readonly WarmupQueueMessage[],
  reason: string,
): void {
  for (const message of messages) {
    console.warn("warmup_queue_skip", {
      messageId: message.id,
      reason,
    });
    message.ack();
  }
}

export async function processWarmupQueueBatch(
  batch: { messages: readonly WarmupQueueMessage[] },
  env: WarmupEnv,
): Promise<void> {
  const secrets = parseWarmupSecrets(env);
  if (!secrets) {
    ackMessagesWithoutSend(batch.messages, "missing_secrets");
    return;
  }

  for (let index = 0; index < batch.messages.length; index += 1) {
    const gate = await checkWarmupSendGate(env);
    if (!gate.ok) {
      if (gate.reason === "paused") {
        await deliverPauseAlertIfPending(env, secrets);
      }
      ackMessagesWithoutSend(batch.messages.slice(index), gate.reason);
      return;
    }

    const message = batch.messages[index];
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

    const gateAfterSend = await checkWarmupSendGate(env);
    if (!gateAfterSend.ok && gateAfterSend.reason === "paused") {
      await deliverPauseAlertIfPending(env, secrets);
      ackMessagesWithoutSend(batch.messages.slice(index), "paused");
      return;
    }

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
      if (result.permanent) {
        await sendToDlqIfAllowed(env, {
          reason: "send_failed_permanent",
          toRedacted: redactEmailForLog(body.to),
          at: new Date().toISOString(),
        });
        message.ack();
        continue;
      }
      message.retry();
      continue;
    }

    message.ack();
  }
}
