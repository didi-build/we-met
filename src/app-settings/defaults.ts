import type { EmailProvider } from "@/email/email-provider";

/** App settings keys in D1 `app_settings` (ADR 0025). */
export const APP_SETTING_SIGNUPS_OPEN = "signups_open";
export const APP_SETTING_LEAD_EMAIL_ENABLED = "lead_email_enabled";
export const APP_SETTING_DAILY_CAP_GLOBAL = "daily_cap_global";
export const APP_SETTING_DAILY_CAP_PER_CARD = "daily_cap_per_card";
export const APP_SETTING_EMAIL_PROVIDER = "email_provider";
export const APP_SETTING_VISITOR_EMAIL_MODE = "visitor_email_mode";

export type VisitorEmailMode = "owner_relay" | "direct";

/**
 * Missing or empty `signups_open` is treated as closed (sign-ups off).
 * Matches the 0005 seed and fail-closed launch posture.
 */
export function signupsOpenFromSettingValue(value: string | null | undefined): boolean {
  if (value === undefined || value === null || value.trim() === "") {
    return false;
  }
  const normalized = value.trim();
  return normalized === "1" || normalized.toLowerCase() === "true";
}

/**
 * Missing or empty `lead_email_enabled` defaults to enabled so pre-seed databases
 * and rows not yet migrated do not block lead email until settings are applied.
 */
/**
 * Missing or unknown `email_provider` defaults to Gmail (legacy behavior until flipped).
 */
export function emailProviderFromSettingValue(
  value: string | null | undefined,
): EmailProvider {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "cloudflare") {
    return "cloudflare";
  }
  return "gmail";
}

export function leadEmailEnabledFromSettingValue(
  value: string | null | undefined,
): boolean {
  if (value === undefined || value === null || value.trim() === "") {
    return true;
  }
  const normalized = value.trim();
  return normalized === "1" || normalized.toLowerCase() === "true";
}

/**
 * Missing, empty, or unknown `visitor_email_mode` defaults to `owner_relay` so visitors
 * are not emailed until operators opt into direct follow-up.
 */
export function visitorEmailModeFromSettingValue(
  value: string | null | undefined,
): VisitorEmailMode {
  if (value === undefined || value === null || value.trim() === "") {
    return "owner_relay";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "direct") {
    return "direct";
  }
  return "owner_relay";
}
