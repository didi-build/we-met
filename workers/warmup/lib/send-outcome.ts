import type { WarmupEnv, WarmupSecrets } from "./config";
import { pauseWarmupForSendError } from "./pause";
import { recordWarmupSuccessfulSend } from "./send-cap";
import { shouldPauseForSendError } from "./send-error";
import type { WarmupSendResult } from "./send-warmup-email";

export async function handleWarmupSendResult(
  env: WarmupEnv,
  secrets: WarmupSecrets,
  result: WarmupSendResult,
  now: Date = new Date(),
): Promise<void> {
  if (result.ok) {
    await recordWarmupSuccessfulSend(env, now);
    return;
  }
  if (result.code === "send_failed" && shouldPauseForSendError(result.errorCode)) {
    await pauseWarmupForSendError(env, secrets, result.errorCode!);
  }
}
