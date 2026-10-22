import type { WarmupDlqBody, WarmupEnv } from "./config";

export type DlqGuardResult =
  { ok: true } | { ok: false; reason: "missing_binding" | "invalid_body" };

export function guardDlqSend(
  env: Pick<WarmupEnv, "WARMUP_DLQ">,
  body: WarmupDlqBody,
): DlqGuardResult {
  if (!env.WARMUP_DLQ) {
    return { ok: false, reason: "missing_binding" };
  }
  if (!body.reason.trim() || !body.toRedacted.trim() || !body.at.trim()) {
    return { ok: false, reason: "invalid_body" };
  }
  return { ok: true };
}

export async function sendToDlqIfAllowed(
  env: Pick<WarmupEnv, "WARMUP_DLQ">,
  body: WarmupDlqBody,
): Promise<DlqGuardResult> {
  const guard = guardDlqSend(env, body);
  if (!guard.ok) {
    return guard;
  }
  await env.WARMUP_DLQ!.send(body);
  return { ok: true };
}
