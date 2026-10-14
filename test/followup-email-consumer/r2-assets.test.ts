import { describe, expect, it, vi } from "vitest";
import { CARD_PHOTO_JPEG_CONTENT_TYPE } from "@/assets/card-photo";
import { createReadOnlyConsumerAssets } from "@/followup-email-consumer/r2-assets";
import { buildOwnerVCardAttachment } from "@/followup-email-consumer/load-vcard-photo";
import type { CardContact } from "@/card-data/types";

const contact: CardContact = {
  name: { full: "Demo User", family: "User", given: "Demo", nickname: "Demo" },
  org: "Co",
  title: "Role",
  email: "owner@example.com",
  phone: "+1",
  vcardNote: "note",
  urls: [],
};

describe("createReadOnlyConsumerAssets (unit)", () => {
  it("reads JPEG content type from R2ObjectBody httpMetadata", async () => {
    const bucket = {
      get: vi.fn(async () => ({
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([0xff, 0xd8, 0xff]));
            controller.close();
          },
        }),
        httpMetadata: { contentType: CARD_PHOTO_JPEG_CONTENT_TYPE },
      })),
    };
    const assets = createReadOnlyConsumerAssets(bucket as never);
    const result = await buildOwnerVCardAttachment(contact, "photos/demo.jpg", assets, {
      logMissingPhoto: vi.fn(),
      logNonJpegPhoto: vi.fn(),
    });
    expect(result.vcardBody).toContain("PHOTO;ENCODING=b;TYPE=JPEG:");
    expect(bucket.get).toHaveBeenCalledWith("photos/demo.jpg");
  });

  it("omits photo and logs when httpMetadata is not JPEG", async () => {
    const logNonJpegPhoto = vi.fn();
    const bucket = {
      get: vi.fn(async () => ({
        body: new ReadableStream(),
        httpMetadata: { contentType: "image/png" },
      })),
    };
    const assets = createReadOnlyConsumerAssets(bucket as never);
    const result = await buildOwnerVCardAttachment(contact, "photos/demo.png", assets, {
      logMissingPhoto: vi.fn(),
      logNonJpegPhoto,
    });
    expect(result.vcardBody).not.toContain("PHOTO;");
    expect(logNonJpegPhoto).toHaveBeenCalledWith("photos/demo.png");
  });

  it("omits photo and logs when object is missing", async () => {
    const logMissingPhoto = vi.fn();
    const bucket = { get: vi.fn(async () => null) };
    const assets = createReadOnlyConsumerAssets(bucket as never);
    const result = await buildOwnerVCardAttachment(
      contact,
      "photos/missing.jpg",
      assets,
      { logMissingPhoto, logNonJpegPhoto: vi.fn() },
    );
    expect(result.vcardBody).not.toContain("PHOTO;");
    expect(logMissingPhoto).toHaveBeenCalledWith("photos/missing.jpg");
  });
});
