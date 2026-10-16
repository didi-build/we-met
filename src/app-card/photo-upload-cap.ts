import { nowIso } from "@/app-auth/time";
import type { D1Database } from "@cloudflare/workers-types";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_UPLOADS_PER_HOUR = 5;

function cutoffIso(): string {
  return new Date(Date.now() - WINDOW_MS).toISOString();
}

export async function prunePhotoUploadLog(
  db: D1Database,
  accountId: string,
): Promise<void> {
  const cutoff = cutoffIso();
  await db
    .prepare("DELETE FROM photo_upload_log WHERE account_id = ? AND uploaded_at < ?")
    .bind(accountId, cutoff)
    .run();
}

/** Reserve one upload slot before processing; returns reservation timestamp or null if capped. */
export async function reservePhotoUploadSlot(
  db: D1Database,
  accountId: string,
): Promise<string | null> {
  await prunePhotoUploadLog(db, accountId);
  const uploadedAt = nowIso();
  const cutoff = cutoffIso();
  const result = await db
    .prepare(
      `INSERT INTO photo_upload_log (account_id, uploaded_at)
       SELECT ?, ?
       WHERE (SELECT COUNT(*) FROM photo_upload_log
              WHERE account_id = ? AND uploaded_at >= ?) < ?`,
    )
    .bind(accountId, uploadedAt, accountId, cutoff, MAX_UPLOADS_PER_HOUR)
    .run();
  if ((result.meta.changes ?? 0) < 1) {
    return null;
  }
  return uploadedAt;
}

export async function releasePhotoUploadReservation(
  db: D1Database,
  accountId: string,
  uploadedAt: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM photo_upload_log WHERE account_id = ? AND uploaded_at = ?")
    .bind(accountId, uploadedAt)
    .run();
}

export async function countPhotoUploadsInWindow(
  db: D1Database,
  accountId: string,
): Promise<number> {
  await prunePhotoUploadLog(db, accountId);
  const cutoff = cutoffIso();
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM photo_upload_log WHERE account_id = ? AND uploaded_at >= ?`,
    )
    .bind(accountId, cutoff)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export const PHOTO_UPLOAD_CAP_PER_HOUR = MAX_UPLOADS_PER_HOUR;
export const PHOTO_UPLOAD_WINDOW_MS = WINDOW_MS;
