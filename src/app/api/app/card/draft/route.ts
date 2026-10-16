import {
  authorizeActiveAppCardRoute,
  guardAppMutation,
  refreshSessionCookie,
} from "@/app-card/app-route";
import { saveDraft } from "@/app-card/card-store";
import { jsonOk } from "@/app-card/route-auth";
import { validateEditorCardForDraft } from "@/app-card/validate-editor-card";
import { apiError, apiJson } from "@/app-auth/guards";
import type { EditorCard } from "@/app-api/types";

const ROUTE_KEY = "card-draft";

export async function PUT(request: Request) {
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
  if (!body || typeof body !== "object") {
    return apiError("forbidden", 403);
  }
  const card = (body as { card?: EditorCard }).card;
  if (!card) {
    return apiError("forbidden", 403);
  }
  const validation = validateEditorCardForDraft(card);
  if (!validation.ok) {
    if (validation.code === "invalid-fields") {
      return apiJson(
        { error: { code: validation.code, fields: validation.fields } },
        { status: 422 },
      );
    }
    return apiError(validation.code, 422);
  }
  const updatedAt = await saveDraft(ctx.env.WE_MET_DB, auth.account.id, card);
  const response = jsonOk({ updatedAt });
  return refreshSessionCookie(response, auth);
}
