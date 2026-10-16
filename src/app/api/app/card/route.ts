import { loadCardBundle } from "@/app-card/card-store";
import {
  authorizeActiveAppCardRoute,
  readAppCardRouteContext,
  refreshSessionCookie,
} from "@/app-card/app-route";
import { jsonOk } from "@/app-card/route-auth";
const ROUTE_KEY = "card-get";

export async function GET() {
  const base = await readAppCardRouteContext();
  if (!base.ok) {
    return base.response;
  }
  const authResult = await authorizeActiveAppCardRoute(ROUTE_KEY);
  if (!authResult.ok) {
    return authResult.response;
  }
  const { ctx, auth } = authResult;
  const bundle = await loadCardBundle(ctx.env.WE_MET_DB, auth.account.id);
  const response = jsonOk({
    draft: bundle.draft,
    published: bundle.published,
    updatedAt: bundle.updatedAt,
  });
  return refreshSessionCookie(response, auth);
}
