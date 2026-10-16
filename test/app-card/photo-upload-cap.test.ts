import {
  PHOTO_UPLOAD_CAP_PER_HOUR,
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
});
