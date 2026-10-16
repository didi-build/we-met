import {
  authorizeActiveAppCardRoute,
  guardAppMutation,
  refreshSessionCookie,
} from "@/app-card/app-route";
import { saveDraft } from "@/app-card/card-store";
import { parseEditorCardWire } from "@/app-card/parse-editor-card";
import { readJsonBodyWithCap } from "@/app-card/read-json-body";
import { jsonOk } from "@/app-card/route-auth";
import { validateEditorCardForDraft } from "@/app-card/validate-editor-card";
import { apiError, apiJson } from "@/app-auth/guards";

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

  const validation = validateEditorCardForDraft(parsed.card);
  if (!validation.ok) {
    if (validation.code === "invalid-fields") {
      return apiJson(
        { error: { code: validation.code, fields: validation.fields } },
        { status: 422 },
      );
    }
    return apiError(validation.code, 422);
  }
  const updatedAt = await saveDraft(ctx.env.WE_MET_DB, auth.account.id, parsed.card);
  const response = jsonOk({ updatedAt });
  return refreshSessionCookie(response, auth);
}
