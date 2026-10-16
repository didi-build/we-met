import {
  authorizeActiveAppCardRoute,
  guardAppMutation,
  refreshSessionCookie,
} from "@/app-card/app-route";
import {
  loadDraftPhotoKey,
  loadPublishedSlug,
  publishCard,
} from "@/app-card/card-store";
import { isValidPhotoKey } from "@/app-card/photo-key";
import { parseEditorCardWire } from "@/app-card/parse-editor-card";
import { readJsonBodyWithCap } from "@/app-card/read-json-body";
import { PublishCardError } from "@/app-card/publish-errors";
import { jsonOk } from "@/app-card/route-auth";
import { validateEditorCardForPublish } from "@/app-card/validate-editor-card";
import { apiError, apiJson } from "@/app-auth/guards";
import { readLandingBrowseOrigin } from "@/lib/landing/server-config";
import { CARD_PHOTO_JPEG_CONTENT_TYPE } from "@/assets/card-photo";

const ROUTE_KEY = "card-publish";

export async function POST(request: Request) {
  const authResult = await authorizeActiveAppCardRoute(ROUTE_KEY);
  if (!authResult.ok) {
    return authResult.response;
  }
  const { ctx, auth } = authResult;
  const blocked = guardAppMutation(request, ctx, "application/json");
  if (blocked) {
    return blocked;
  }

  const bodyRead = await readJsonBodyWithCap(request);
  if (!bodyRead.ok) {
    if (bodyRead.reason === "invalid-json") {
      return apiError("invalid-json", 400);
    }
    if (bodyRead.reason === "too-large") {
      return new Response(null, { status: 413 });
    }
    return apiError("invalid-json", 400);
  }

  const parsed = parseEditorCardWire(bodyRead.json);
  if (!parsed.ok) {
    return apiJson(
      { error: { code: "invalid-fields", fields: parsed.fields } },
      { status: 422 },
    );
  }
  const card = parsed.card;

  const validation = validateEditorCardForPublish(card);
  if (!validation.ok) {
    if (validation.code === "invalid-fields") {
      return apiJson(
        { error: { code: "invalid-fields", fields: validation.fields } },
        { status: 422 },
      );
    }
    return apiError(validation.code, 422);
  }

  const publishedSlug = await loadPublishedSlug(ctx.env.WE_MET_DB, auth.account.id);
  if (publishedSlug && publishedSlug !== card.slug.trim()) {
    return apiError("slug-locked", 409);
  }

  let photoKey = await loadDraftPhotoKey(ctx.env.WE_MET_DB, auth.account.id);
  if (photoKey && !isValidPhotoKey(photoKey)) {
    photoKey = null;
  }
  if (photoKey) {
    const head = await ctx.env.WE_MET_ASSETS.head(photoKey);
    if (!head || head.httpMetadata?.contentType !== CARD_PHOTO_JPEG_CONTENT_TYPE) {
      return apiError("invalid-photo", 422);
    }
  }

  try {
    const result = await publishCard(
      ctx.env.WE_MET_DB,
      auth.account.id,
      card,
      photoKey,
    );
    const browseOrigin = await readLandingBrowseOrigin(ctx.hostConfig);
    const url = `${browseOrigin.replace(/\/$/, "")}${result.path}`;
    const response = jsonOk({ url });
    return refreshSessionCookie(response, auth);
  } catch (err) {
    if (err instanceof PublishCardError) {
      if (err.code === "slug-locked") {
        return apiError("slug-locked", 409);
      }
      if (err.code === "slug-taken") {
        return apiError("slug-taken", 409);
      }
      if (err.code === "forbidden") {
        return apiError("forbidden", 403);
      }
    }
    throw err;
  }
}
