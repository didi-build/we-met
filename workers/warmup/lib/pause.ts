import type { WarmupEnv, WarmupSecrets } from "./config";
import {
  markWarmupPauseAlertSent,
  readWarmupPaused,
  writeWarmupPaused,
  type WarmupPausedState,
} from "./state";
import { pauseReasonForSendError } from "./send-error";

export async function setWarmupPaused(
  env: Pick<WarmupEnv, "WARMUP_STATE">,
  reason: string,
  at: string = new Date().toISOString(),
): Promise<WarmupPausedState | null> {
  const kv = env.WARMUP_STATE;
  if (!kv) {
    return null;
  }
  const existing = await readWarmupPaused(kv);
  if (existing && existing !== "read_failed") {
    return existing;
  }
  const state: WarmupPausedState = { reason, at };
  const ok = await writeWarmupPaused(kv, state);
  return ok ? state : null;
}

/** Send the pause alert when `paused` exists and `alertSent` is not set. Safe to call on every tick. */
export async function deliverPauseAlertIfPending(
  env: WarmupEnv,
  secrets: WarmupSecrets,
): Promise<boolean> {
  const kv = env.WARMUP_STATE;
  if (!kv) {
    return false;
  }
  const paused = await readWarmupPaused(kv);
  if (!paused || paused === "read_failed") {
    return false;
  }
  if (paused.alertSent) {
    return false;
  }
  const sent = await sendWarmupPauseAlert(env, secrets, paused);
  if (sent) {
    await markWarmupPauseAlertSent(kv);
  }
  return sent;
}

export async function sendWarmupPauseAlert(
  env: WarmupEnv,
  secrets: WarmupSecrets,
  paused: WarmupPausedState,
): Promise<boolean> {
  const alertTo = env.WARMUP_ALERT_TO?.trim();
  if (!alertTo || !env.EMAIL) {
    console.warn("warmup_pause_alert_skipped", {
      reason: !alertTo ? "missing_alert_to" : "missing_email_binding",
    });
    return false;
  }
  const subject = "We Met warmup worker paused";
  const text = [
    "The we-met warmup cron worker auto-paused sending.",
    "",
    `Reason: ${paused.reason}`,
    `At: ${paused.at}`,
    "",
    "To resume: delete the paused key in WARMUP_STATE KV (or fix the underlying issue), then ensure enabled is true.",
  ].join("\n");
  const html = text
    .split("\n")
    .map((line) => (line.length === 0 ? "<br>" : `<p>${line}</p>`))
    .join("");
  try {
    await env.EMAIL.send({
      from: { email: secrets.from },
      to: alertTo,
      subject,
      text,
      html,
    });
    console.log("warmup_pause_alert_sent", { at: paused.at });
    return true;
  } catch (error) {
    console.error("warmup_pause_alert_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

/**
 * Pause (if not already), send at most one alert per pause episode, then stop sending.
 */
export async function pauseWarmupAndAlertOnce(
  env: WarmupEnv,
  secrets: WarmupSecrets,
  reason: string,
): Promise<void> {
  const kv = env.WARMUP_STATE;
  if (!kv) {
    return;
  }
  const at = new Date().toISOString();
  let paused = await readWarmupPaused(kv);
  if (paused === "read_failed") {
    return;
  }
  if (!paused) {
    const created = await setWarmupPaused(env, reason, at);
    if (!created) {
      return;
    }
    paused = created;
  }
  await deliverPauseAlertIfPending(env, secrets);
}

export async function pauseWarmupForSendError(
  env: WarmupEnv,
  secrets: WarmupSecrets,
  errorCode: string,
): Promise<void> {
  const reason = pauseReasonForSendError(errorCode);
  await pauseWarmupAndAlertOnce(env, secrets, reason);
}
