import { redactEmailForLog } from "./redact-email";

export const WARMUP_FROM_DOMAIN = "mail.we-met.link";

export function isAllowedWarmupFromAddress(from: string): boolean {
  const normalized = from.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) {
    return false;
  }
  const domain = normalized.slice(at + 1);
  return domain === WARMUP_FROM_DOMAIN;
}

export function logInvalidWarmupFrom(from: string): void {
  console.warn("warmup_config_rejected", {
    reason: "invalid_from",
    from: redactEmailForLog(from),
  });
}
