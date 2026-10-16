import {
  APP_SETTING_DAILY_CAP_GLOBAL,
  APP_SETTING_DAILY_CAP_PER_CARD,
  APP_SETTING_LEAD_EMAIL_ENABLED,
  leadEmailEnabledFromSettingValue,
} from "@/app-settings/defaults";
import type { D1Database } from "@cloudflare/workers-types";

export type LeadEmailControls = {
  leadEmailEnabled: boolean;
  dailyCapGlobal: number | null;
  dailyCapPerCard: number | null;
};

const POSITIVE_CAP_DIGITS = /^\d+$/;

export function parsePositiveCapValue(value: string | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "" || !POSITIVE_CAP_DIGITS.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (parsed <= 0) {
    return null;
  }
  return parsed;
}

export function leadEmailSubmissionAllowed(
  controls: LeadEmailControls,
  usage: { globalUsed: number; cardUsed: number },
  needed: number,
): boolean {
  if (!controls.leadEmailEnabled) {
    return false;
  }
  if (controls.dailyCapGlobal === null || controls.dailyCapPerCard === null) {
    return false;
  }
  return (
    usage.globalUsed + needed <= controls.dailyCapGlobal &&
    usage.cardUsed + needed <= controls.dailyCapPerCard
  );
}

export async function readLeadEmailControls(
  db: D1Database,
): Promise<LeadEmailControls> {
  const rows = await db
    .prepare(
      `SELECT key, value FROM app_settings
       WHERE key IN (?, ?, ?)`,
    )
    .bind(
      APP_SETTING_LEAD_EMAIL_ENABLED,
      APP_SETTING_DAILY_CAP_GLOBAL,
      APP_SETTING_DAILY_CAP_PER_CARD,
    )
    .all<{ key: string; value: string }>();

  const byKey = new Map(rows.results.map((row) => [row.key, row.value]));
  return {
    leadEmailEnabled: leadEmailEnabledFromSettingValue(
      byKey.get(APP_SETTING_LEAD_EMAIL_ENABLED),
    ),
    dailyCapGlobal: parsePositiveCapValue(byKey.get(APP_SETTING_DAILY_CAP_GLOBAL)),
    dailyCapPerCard: parsePositiveCapValue(byKey.get(APP_SETTING_DAILY_CAP_PER_CARD)),
  };
}

export async function readLeadEmailEnabled(db: D1Database): Promise<boolean> {
  const controls = await readLeadEmailControls(db);
  return controls.leadEmailEnabled;
}
