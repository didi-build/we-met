import { getAssetStorage } from "@/assets/get-storage";
import {
  CARD_PHOTO_JPEG_CONTENT_TYPE,
  logNonJpegCardPhoto,
  notFoundRouteResponse,
} from "@/assets/card-photo";
import { isValidSlug } from "@/card-data/slug";
import { resolveCardForRequest } from "@/card-data/server";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;

  if (!isValidSlug(slug)) {
    return notFoundRouteResponse();
  }

  const url = new URL(request.url);
  const keyFromQuery = url.searchParams.get("key") ?? url.searchParams.get("photoKey");
  if (keyFromQuery) {
    return notFoundRouteResponse();
  }

  const card = await resolveCardForRequest(`/hi/${slug}`);
  if (!card || card.slug !== slug || !card.photoKey) {
    return notFoundRouteResponse();
  }

  const storage = await getAssetStorage();
  const asset = await storage.getObject(card.photoKey);
  if (!asset) {
    return notFoundRouteResponse();
  }

  if (asset.contentType !== CARD_PHOTO_JPEG_CONTENT_TYPE) {
    logNonJpegCardPhoto(slug, card.photoKey);
    return notFoundRouteResponse();
  }

  return new Response(asset.body, {
    headers: {
      "Content-Type": CARD_PHOTO_JPEG_CONTENT_TYPE,
      "Cache-Control": IMMUTABLE_CACHE,
      "Content-Length": String(asset.size),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
