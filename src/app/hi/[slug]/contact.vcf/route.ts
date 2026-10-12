import { getAssetStorage } from "@/assets/get-storage";
import { resolveHiCardPage } from "@/lib/hi-card/resolve-card-route";
import { buildVCard, readAssetAsBase64, type VCardPhoto } from "@/lib/hi/vcard";

const VCARD_CACHE_CONTROL = "private, max-age=0, must-revalidate";

type RouteContext = { params: Promise<{ slug: string }> };

function vcardFilename(card: { contact: { name: { full: string } } }): string {
  const safe = card.contact.name.full.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe || "contact"}.vcf`;
}

async function loadPhotoForVcard(photoKey: string | null): Promise<VCardPhoto | null> {
  if (!photoKey) {
    return null;
  }
  const storage = await getAssetStorage();
  const asset = await storage.getObject(photoKey);
  if (!asset) {
    return null;
  }
  const base64 = await readAssetAsBase64(asset);
  const mime =
    asset.contentType === "image/png"
      ? "image/png"
      : asset.contentType === "image/jpeg" || asset.contentType === "image/jpg"
        ? "image/jpeg"
        : "image/jpeg";
  return { base64, mime };
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const card = await resolveHiCardPage(slug);
  const photo = await loadPhotoForVcard(card.photoKey);
  const body = buildVCard(card.contact, { photo });

  return new Response(body, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `inline; filename="${vcardFilename(card)}"`,
      "Cache-Control": VCARD_CACHE_CONTROL,
    },
  });
}
