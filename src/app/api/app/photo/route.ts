import {
  authorizeActiveAppCardRoute,
  guardAppMutation,
  refreshSessionCookie,
} from "@/app-card/app-route";
import {
  clearDraftPhotoKey,
  loadDraftPhotoKey,
  setDraftPhotoKey,
} from "@/app-card/card-store";
import { draftPhotoUrl } from "@/app-card/editor-persist";
import { isValidPhotoKey } from "@/app-card/photo-key";
import {
  releasePhotoUploadReservation,
  reservePhotoUploadSlot,
} from "@/app-card/photo-upload-cap";
import { jsonOk } from "@/app-card/route-auth";
import { CARD_PHOTO_JPEG_CONTENT_TYPE } from "@/assets/card-photo";
import { getAssetStorage } from "@/assets/get-storage";
import { apiError, withNoStoreHeaders } from "@/app-auth/guards";
import { ingestCardPhotoFromRequest } from "@/images/ingest-card-photo";

const POST_ROUTE_KEY = "photo-upload";
const GET_ROUTE_KEY = "photo-get";
const DELETE_ROUTE_KEY = "photo-delete";

function mapIngestErrorToResponse(
  error: import("@/images/ingest-card-photo").IngestCardPhotoError,
): Response {
  if (error === "too-large") {
    return new Response(null, { status: 413 });
  }
  if (error === "unsupported-type") {
    return new Response(null, { status: 415 });
  }
  if (error === "images-unavailable") {
    return new Response(null, { status: 503 });
  }
  return apiError("invalid-photo", 422);
}

export async function POST(request: Request) {
  try {
    const authResult = await authorizeActiveAppCardRoute(POST_ROUTE_KEY);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { ctx, auth } = authResult;
    const blocked = guardAppMutation(request, ctx, "image/jpeg");
    if (blocked) {
      return blocked;
    }

    const reservation = await reservePhotoUploadSlot(
      ctx.env.WE_MET_DB,
      auth.account.id,
    );
    if (!reservation) {
      return apiError("rate-limited", 429);
    }

    const result = await ingestCardPhotoFromRequest(request, {
      images: ctx.env.IMAGES as
        import("@cloudflare/workers-types").ImagesBinding | undefined,
      assets: ctx.env.WE_MET_ASSETS,
    });

    if (!result.ok) {
      await releasePhotoUploadReservation(
        ctx.env.WE_MET_DB,
        auth.account.id,
        reservation,
      );
      return mapIngestErrorToResponse(result.error);
    }

    await setDraftPhotoKey(ctx.env.WE_MET_DB, auth.account.id, result.key);
    const url = draftPhotoUrl(result.key);
    const response = jsonOk({ url });
    return refreshSessionCookie(response, auth);
  } catch (err) {
    console.error("app photo POST failed", err instanceof Error ? err.name : "error");
    return apiError("unavailable", 503);
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await authorizeActiveAppCardRoute(DELETE_ROUTE_KEY);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { ctx, auth } = authResult;
    const blocked = guardAppMutation(request, ctx, "application/json");
    if (blocked) {
      return blocked;
    }

    await clearDraftPhotoKey(ctx.env.WE_MET_DB, auth.account.id);
    const response = jsonOk({ ok: true });
    return refreshSessionCookie(response, auth);
  } catch (err) {
    console.error("app photo DELETE failed", err instanceof Error ? err.name : "error");
    return apiError("unavailable", 503);
  }
}

export async function GET(request: Request) {
  try {
    const authResult = await authorizeActiveAppCardRoute(GET_ROUTE_KEY);
    if (!authResult.ok) {
      return authResult.response;
    }
    const { ctx, auth } = authResult;
    const key = new URL(request.url).searchParams.get("v")?.trim() ?? "";
    if (!isValidPhotoKey(key)) {
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
  } catch (err) {
    console.error("app photo GET failed", err instanceof Error ? err.name : "error");
    return apiError("unavailable", 503);
  }
}
