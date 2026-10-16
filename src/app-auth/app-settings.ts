import {
  APP_SETTING_SIGNUPS_OPEN,
  signupsOpenFromSettingValue,
} from "@/app-settings/defaults";
import type { D1Database } from "@cloudflare/workers-types";

export async function readSignupsOpen(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .bind(APP_SETTING_SIGNUPS_OPEN)
    .first<{ value: string }>();
  return signupsOpenFromSettingValue(row?.value);
}
