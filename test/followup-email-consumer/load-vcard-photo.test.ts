import { describe, expect, it, vi } from "vitest";
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

describe("buildOwnerVCardAttachment (unit)", () => {
  it("includes photo when JPEG object exists", async () => {
    const get = vi.fn(async () => ({
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0xff, 0xd8, 0xff]));
          controller.close();
        },
      }),
      contentType: "image/jpeg",
    }));
    const result = await buildOwnerVCardAttachment(
      contact,
      "photos/demo.jpg",
      { get },
      { logMissingPhoto: vi.fn(), logNonJpegPhoto: vi.fn() },
    );
    expect(result.vcardBody).toContain("PHOTO;ENCODING=b;TYPE=JPEG:");
    expect(get).toHaveBeenCalledWith("photos/demo.jpg");
  });

  it("omits photo when key is null", async () => {
    const get = vi.fn();
    const result = await buildOwnerVCardAttachment(
      contact,
      null,
      { get },
      { logMissingPhoto: vi.fn(), logNonJpegPhoto: vi.fn() },
    );
    expect(result.vcardBody).not.toContain("PHOTO;");
    expect(get).not.toHaveBeenCalled();
  });

  it("omits photo and logs when object is not JPEG", async () => {
    const logNonJpegPhoto = vi.fn();
    const get = vi.fn(async () => ({
      body: new ReadableStream(),
      contentType: "image/png",
    }));
    const result = await buildOwnerVCardAttachment(
      contact,
      "photos/demo.png",
      { get },
      { logMissingPhoto: vi.fn(), logNonJpegPhoto },
    );
    expect(result.vcardBody).not.toContain("PHOTO;");
    expect(logNonJpegPhoto).toHaveBeenCalledWith("photos/demo.png");
  });
});
