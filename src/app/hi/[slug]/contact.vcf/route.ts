import { getAssetStorage } from "@/assets/get-storage";
import {
  CARD_PHOTO_JPEG_CONTENT_TYPE,
  logNonJpegCardPhoto,
  notFoundRouteResponse,
} from "@/assets/card-photo";
import { tryResolveHiCard } from "@/lib/hi-card/resolve-card-route";
import { buildVCard, readAssetAsBase64 } from "@/lib/hi/vcard";

const VCARD_CACHE_CONTROL = "private, max-age=0, must-revalidate";

type RouteContext = { params: Promise<{ slug: string }> };

function vcardFilename(card: { contact: { name: { full: string } } }): string {
  const safe = card.contact.name.full.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe || "contact"}.vcf`;
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const card = await tryResolveHiCard(slug);
  if (!card) {
    return notFoundRouteResponse();
  }

  let photoBase64: string | null = null;
  if (card.photoKey) {
    const storage = await getAssetStorage();
    const asset = await storage.getObject(card.photoKey);
    if (asset?.contentType === CARD_PHOTO_JPEG_CONTENT_TYPE) {
      photoBase64 = await readAssetAsBase64(asset);
    } else if (asset) {
      logNonJpegCardPhoto(slug, card.photoKey);
    }
  }

  const body = buildVCard(card.contact, {
    ownerEmail: card.email,
    photo: photoBase64 ? { base64: photoBase64 } : null,
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `inline; filename="${vcardFilename(card)}"`,
      "Cache-Control": VCARD_CACHE_CONTROL,
    },
  });
}
