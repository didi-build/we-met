/** App settings keys in D1 `app_settings` (ADR 0025). */
export const APP_SETTING_SIGNUPS_OPEN = "signups_open";
export const APP_SETTING_LEAD_EMAIL_ENABLED = "lead_email_enabled";

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
export function leadEmailEnabledFromSettingValue(
  value: string | null | undefined,
): boolean {
  if (value === undefined || value === null || value.trim() === "") {
    return true;
  }
  const normalized = value.trim();
  return normalized === "1" || normalized.toLowerCase() === "true";
}
