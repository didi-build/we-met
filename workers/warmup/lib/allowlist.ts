import { redactEmailForLog } from "./redact-email";

export function normalizeRecipient(email: string): string {
  return email.trim().toLowerCase();
}

export function isSeedRecipient(recipient: string, seeds: readonly string[]): boolean {
  const normalized = normalizeRecipient(recipient);
  return seeds.includes(normalized);
}

export type AllowlistRejectReason = "not_in_seeds";

export function assertSeedRecipient(
  recipient: string,
  seeds: readonly string[],
): { ok: true } | { ok: false; reason: AllowlistRejectReason; redacted: string } {
  if (!isSeedRecipient(recipient, seeds)) {
    return {
      ok: false,
      reason: "not_in_seeds",
      redacted: redactEmailForLog(recipient),
    };
  }
  return { ok: true };
}
