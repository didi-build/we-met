import { nowIso } from "@/app-auth/time";
import type { D1Database } from "@cloudflare/workers-types";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_UPLOADS_PER_HOUR = 5;

export async function recordPhotoUpload(
  db: D1Database,
  accountId: string,
): Promise<void> {
  await db
    .prepare("INSERT INTO photo_upload_log (account_id, uploaded_at) VALUES (?, ?)")
    .bind(accountId, nowIso())
    .run();
}

export async function isPhotoUploadRateLimited(
  db: D1Database,
  accountId: string,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
  await db
    .prepare("DELETE FROM photo_upload_log WHERE account_id = ? AND uploaded_at < ?")
    .bind(accountId, cutoff)
    .run();

  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM photo_upload_log WHERE account_id = ? AND uploaded_at >= ?`,
    )
    .bind(accountId, cutoff)
    .first<{ n: number }>();

  return (row?.n ?? 0) >= MAX_UPLOADS_PER_HOUR;
}

export const PHOTO_UPLOAD_CAP_PER_HOUR = MAX_UPLOADS_PER_HOUR;
