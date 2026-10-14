import { CARD_PHOTO_JPEG_CONTENT_TYPE } from "@/assets/card-photo";
import { buildVCard, readAssetAsBase64, type VCardPhoto } from "@/lib/hi/vcard";
import type { CardContact } from "@/card-data/types";

/** R2 access for the consumer: read-only (`get` only). */
export type ReadOnlyR2Assets = {
  get(
    key: string,
  ): Promise<{ body: ReadableStream<Uint8Array>; contentType?: string } | null>;
};

export type VCardBuildResult = {
  vcardBody: string;
  filename: string;
};

export function vcardAttachmentFilename(contact: CardContact): string {
  const safe = contact.name.full.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe || "contact"}.vcf`;
}

export async function buildOwnerVCardAttachment(
  contact: CardContact,
  photoKey: string | null,
  assets: ReadOnlyR2Assets,
  log: { logMissingPhoto(key: string): void; logNonJpegPhoto(key: string): void },
): Promise<VCardBuildResult> {
  let photo: VCardPhoto | null = null;
  if (photoKey) {
    const object = await assets.get(photoKey);
    if (!object) {
      log.logMissingPhoto(photoKey);
    } else if (object.contentType !== CARD_PHOTO_JPEG_CONTENT_TYPE) {
      log.logNonJpegPhoto(photoKey);
    } else {
      photo = { base64: await readAssetAsBase64(object) };
    }
  }

  const vcardBody = buildVCard(contact, { photo });
  return {
    vcardBody,
    filename: vcardAttachmentFilename(contact),
  };
}
