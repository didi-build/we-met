import { readLeadEmailControls, type LeadEmailControls } from "@/app-settings/caps";
import {
  sumCardDailySendCount,
  sumGlobalDailySendCount,
  utcDayFromDate,
} from "@/lead-email/daily-send-counts";
import type { D1Database } from "@cloudflare/workers-types";

export const LEAD_EMAIL_UNAVAILABLE_ERROR = "lead_email_unavailable";

export type LeadEmailCapacityDenialReason =
  "kill_switch" | "cap_reached" | "cap_config_error";

export type LeadEmailCapacityCheck =
  { allowed: true } | { allowed: false; reason: LeadEmailCapacityDenialReason };

export function checkLeadEmailCapacity(
  controls: LeadEmailControls,
  usage: { globalUsed: number; cardUsed: number },
  needed: number,
): LeadEmailCapacityCheck {
  if (!controls.leadEmailEnabled) {
    return { allowed: false, reason: "kill_switch" };
  }
  if (controls.dailyCapGlobal === null || controls.dailyCapPerCard === null) {
    return { allowed: false, reason: "cap_config_error" };
  }
  if (
    usage.globalUsed + needed > controls.dailyCapGlobal ||
    usage.cardUsed + needed > controls.dailyCapPerCard
  ) {
    return { allowed: false, reason: "cap_reached" };
  }
  return { allowed: true };
}

export async function readLeadEmailCapacityCheck(
  db: D1Database,
  cardId: string,
  needed: number,
  now: Date,
): Promise<LeadEmailCapacityCheck> {
  const controls = await readLeadEmailControls(db);
  const day = utcDayFromDate(now);
  const usage = {
    globalUsed: await sumGlobalDailySendCount(db, day),
    cardUsed: await sumCardDailySendCount(db, cardId, day),
  };
  return checkLeadEmailCapacity(controls, usage, needed);
}
