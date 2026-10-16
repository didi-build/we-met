import {
  PHOTO_UPLOAD_CAP_PER_HOUR,
  PHOTO_UPLOAD_WINDOW_MS,
  countPhotoUploadsInWindow,
  releasePhotoUploadReservation,
  reservePhotoUploadSlot,
} from "@/app-card/photo-upload-cap";
import { describe, expect, it } from "vitest";
import { withIsolatedLocalD1 } from "../helpers/d1";

describe("photo upload cap (integration)", () => {
  it("allows five reservations per hour and rejects the sixth", async () => {
    await withIsolatedLocalD1(async (db) => {
      const accountId = "acct-cap";
      const reserved: string[] = [];
      for (let i = 0; i < PHOTO_UPLOAD_CAP_PER_HOUR; i++) {
        const slot = await reservePhotoUploadSlot(db, accountId);
        expect(slot).toBeTruthy();
        if (slot) {
          reserved.push(slot);
        }
      }
      expect(await reservePhotoUploadSlot(db, accountId)).toBeNull();
      expect(await countPhotoUploadsInWindow(db, accountId)).toBe(
        PHOTO_UPLOAD_CAP_PER_HOUR,
      );

      await releasePhotoUploadReservation(db, accountId, reserved[0]);
      expect(await countPhotoUploadsInWindow(db, accountId)).toBe(
        PHOTO_UPLOAD_CAP_PER_HOUR - 1,
      );
      expect(await reservePhotoUploadSlot(db, accountId)).toBeTruthy();
    });
  });

  it("slides the window so uploads older than one hour no longer count", async () => {
    await withIsolatedLocalD1(async (db) => {
      const accountId = "acct-slide";
      const stale = new Date(
        Date.now() - PHOTO_UPLOAD_WINDOW_MS - 60_000,
      ).toISOString();
      for (let i = 0; i < PHOTO_UPLOAD_CAP_PER_HOUR; i++) {
        await db
          .prepare(
            "INSERT INTO photo_upload_log (account_id, uploaded_at) VALUES (?, ?)",
          )
          .bind(accountId, stale)
          .run();
      }
      expect(await countPhotoUploadsInWindow(db, accountId)).toBe(0);
      expect(await reservePhotoUploadSlot(db, accountId)).toBeTruthy();
    });
  });
});
