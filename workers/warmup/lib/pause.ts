import type { WarmupEnv, WarmupSecrets } from "./config";
import {
  isWarmupInvalidPausedState,
  readWarmupPaused,
  readWarmupPausedAlert,
  readWarmupPausedAlertAttempt,
  writeWarmupPaused,
  writeWarmupPausedAlert,
  writeWarmupPausedAlertAttempt,
  warmupPausedEpisodeId,
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
    return existing.state;
  }
  const state: WarmupPausedState = { reason, at };
  const ok = await writeWarmupPaused(kv, state);
  return ok ? state : null;
}

/** Send the pause alert when `paused` exists and no alert was sent for this episode. Safe to call on every tick. */
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
  if (paused.state.alertSent) {
    return false;
  }
  const alertState = await readWarmupPausedAlert(kv);
  if (alertState === "read_failed") {
    console.warn("warmup_pause_alert_state_read_failed");
    return false;
  }
  const episode = await warmupPausedEpisodeId(paused.raw);
  if (alertState?.episode === episode) {
    return false;
  }
  const attemptState = await readWarmupPausedAlertAttempt(kv);
  if (attemptState === "read_failed") {
    console.warn("warmup_pause_alert_attempt_read_failed");
    return false;
  }
  if (attemptState?.episode === episode) {
    console.log("warmup_pause_alert_cooldown", { episode });
    return false;
  }
  const attemptAt = new Date().toISOString();
  const guardWritten = await writeWarmupPausedAlertAttempt(kv, episode, attemptAt);
  if (!guardWritten) {
    console.error("warmup_pause_alert_guard_write_failed", { episode });
    return false;
  }
  const malformed = isWarmupInvalidPausedState(paused.state);
  const sent = await sendWarmupPauseAlert(env, secrets, paused.state, malformed);
  if (sent) {
    const marked = await writeWarmupPausedAlert(kv, episode, new Date().toISOString());
    if (!marked) {
      console.error("warmup_pause_alert_mark_failed", { episode });
    }
  }
  return sent;
}

export async function sendWarmupPauseAlert(
  env: WarmupEnv,
  secrets: WarmupSecrets,
  paused: WarmupPausedState,
  malformed: boolean,
): Promise<boolean> {
  const alertTo = env.WARMUP_ALERT_TO?.trim();
  if (!alertTo || !env.EMAIL) {
    console.warn("warmup_pause_alert_skipped", {
      reason: !alertTo ? "missing_alert_to" : "missing_email_binding",
    });
    return false;
  }
  const subject = "We Met warmup worker paused";
  const text = malformed
    ? [
        "The we-met warmup cron worker auto-paused sending.",
        "",
        "The paused key in WARMUP_STATE KV is malformed and must be fixed or deleted.",
        "",
        "To resume: delete the paused key in WARMUP_STATE KV (or fix the underlying issue), then ensure enabled is true.",
      ].join("\n")
    : [
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
  const paused = await readWarmupPaused(kv);
  if (paused === "read_failed") {
    return;
  }
  if (!paused) {
    const created = await setWarmupPaused(env, reason, at);
    if (!created) {
      return;
    }
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
