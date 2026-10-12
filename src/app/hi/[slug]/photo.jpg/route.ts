import { getAssetStorage } from "@/assets/get-storage";
import { isValidSlug } from "@/card-data/slug";
import { resolveCardForRequest } from "@/card-data/server";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;

  if (!isValidSlug(slug)) {
    return new Response(null, { status: 404 });
  }

  const url = new URL(request.url);
  const keyFromQuery = url.searchParams.get("key") ?? url.searchParams.get("photoKey");
  if (keyFromQuery) {
    return new Response(null, { status: 404 });
  }

  const card = await resolveCardForRequest(`/hi/${slug}`);
  if (!card || card.slug !== slug || !card.photoKey) {
    return new Response(null, { status: 404 });
  }

  const storage = await getAssetStorage();
  const asset = await storage.getObject(card.photoKey);
  if (!asset) {
    return new Response(null, { status: 404 });
  }

  return new Response(asset.body, {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": IMMUTABLE_CACHE,
      "Content-Length": String(asset.size),
    },
  });
}
