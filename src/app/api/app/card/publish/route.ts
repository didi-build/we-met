import {
  authorizeActiveAppCardRoute,
  guardAppMutation,
  refreshSessionCookie,
} from "@/app-card/app-route";
import { loadPublishedSlug, publishCard } from "@/app-card/card-store";
import { photoKeyFromDraftPhotoUrl } from "@/app-card/editor-persist";
import { jsonOk } from "@/app-card/route-auth";
import { validateEditorCardForPublish } from "@/app-card/validate-editor-card";
import { apiError, apiJson } from "@/app-auth/guards";
import { absoluteUrl } from "@/config/we-met";
import type { EditorCard } from "@/app-api/types";

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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("forbidden", 403);
  }
  const card = (body as { card?: EditorCard }).card;
  if (!card) {
    return apiError("forbidden", 403);
  }

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

  const photoKey = photoKeyFromDraftPhotoUrl(card.photo);
  try {
    const result = await publishCard(
      ctx.env.WE_MET_DB,
      auth.account.id,
      card,
      photoKey,
    );
    const baseUrl = ctx.hostConfig.baseUrl;
    const url = absoluteUrl(baseUrl, result.url);
    const response = jsonOk({ url });
    return refreshSessionCookie(response, auth);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "slug-locked") {
      return apiError("slug-locked", 409);
    }
    if (
      message.includes("UNIQUE constraint failed") ||
      message.includes("cards_slug_unique")
    ) {
      return apiError("slug-taken", 409);
    }
    throw err;
  }
}
