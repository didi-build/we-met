import { leadEmailSubmissionAllowed, readLeadEmailControls } from "@/app-settings/caps";
import {
  sumCardDailySendCount,
  sumGlobalDailySendCount,
  utcDayFromDate,
} from "@/lead-email/daily-send-counts";
import type { D1Database } from "@cloudflare/workers-types";

export const LEAD_EMAIL_UNAVAILABLE_ERROR = "lead_email_unavailable";

export async function assertLeadEmailCapacity(
  db: D1Database,
  cardId: string,
  needed: number,
  now: Date,
): Promise<boolean> {
  const controls = await readLeadEmailControls(db);
  const day = utcDayFromDate(now);
  const usage = {
    globalUsed: await sumGlobalDailySendCount(db, day),
    cardUsed: await sumCardDailySendCount(db, cardId, day),
  };
  return leadEmailSubmissionAllowed(controls, usage, needed);
}
