import {
  authorizeActiveAppCardRoute,
  guardAppMutation,
  refreshSessionCookie,
} from "@/app-card/app-route";
import { loadDraftPhotoKey } from "@/app-card/card-store";
import {
  isPhotoUploadRateLimited,
  recordPhotoUpload,
} from "@/app-card/photo-upload-cap";
import { draftPhotoUrl } from "@/app-card/editor-persist";
import { jsonOk } from "@/app-card/route-auth";
import { CARD_PHOTO_JPEG_CONTENT_TYPE } from "@/assets/card-photo";
import { getAssetStorage } from "@/assets/get-storage";
import { apiError, withNoStoreHeaders } from "@/app-auth/guards";
import { ingestCardPhotoFromRequest } from "@/images/ingest-card-photo";

const POST_ROUTE_KEY = "photo-upload";
const GET_ROUTE_KEY = "photo-get";

export async function POST(request: Request) {
  const authResult = await authorizeActiveAppCardRoute(POST_ROUTE_KEY);
  if (!authResult.ok) {
    return authResult.response;
  }
  const { ctx, auth } = authResult;
  const blocked = guardAppMutation(request, ctx, "image/jpeg");
  if (blocked) {
    return blocked;
  }

  if (await isPhotoUploadRateLimited(ctx.env.WE_MET_DB, auth.account.id)) {
    return apiError("rate-limited", 429);
  }

  const result = await ingestCardPhotoFromRequest(request, {
    images: ctx.env.IMAGES as
      import("@cloudflare/workers-types").ImagesBinding | undefined,
    assets: ctx.env.WE_MET_ASSETS,
  });

  if (!result.ok) {
    if (result.error === "too-large") {
      return new Response(null, { status: 413 });
    }
    if (result.error === "unsupported-type") {
      return new Response(null, { status: 415 });
    }
    if (result.error === "images-unavailable") {
      return new Response(null, { status: 503 });
    }
    return apiError("forbidden", 403);
  }

  await recordPhotoUpload(ctx.env.WE_MET_DB, auth.account.id);
  const url = draftPhotoUrl(result.key);
  const response = jsonOk({ url });
  return refreshSessionCookie(response, auth);
}

export async function GET(request: Request) {
  const authResult = await authorizeActiveAppCardRoute(GET_ROUTE_KEY);
  if (!authResult.ok) {
    return authResult.response;
  }
  const { ctx, auth } = authResult;
  const key = new URL(request.url).searchParams.get("v")?.trim() ?? "";
  if (!key) {
    return new Response(null, { status: 404 });
  }
  const draftKey = await loadDraftPhotoKey(ctx.env.WE_MET_DB, auth.account.id);
  if (!draftKey || draftKey !== key) {
    return new Response(null, { status: 404 });
  }
  const storage = await getAssetStorage();
  const asset = await storage.getObject(key);
  if (!asset || asset.contentType !== CARD_PHOTO_JPEG_CONTENT_TYPE) {
    return new Response(null, { status: 404 });
  }
  const response = withNoStoreHeaders(
    new Response(asset.body, {
      status: 200,
      headers: {
        "content-type": CARD_PHOTO_JPEG_CONTENT_TYPE,
        "content-length": String(asset.size),
        "x-content-type-options": "nosniff",
      },
    }),
  );
  return refreshSessionCookie(response, auth);
}
