import {
  authorizeActiveAppCardRoute,
  refreshSessionCookie,
} from "@/app-card/app-route";
import { loadPublishedSlug, slugTakenByOther } from "@/app-card/card-store";
import { jsonOk } from "@/app-card/route-auth";
import { isReservedSlug } from "@/card-data/reserved-slugs";
import { isValidSlug } from "@/card-data/slug";
import { slugFormatCheck } from "@/lib/app-editor/slug";

const ROUTE_KEY = "slug-check";

export async function GET(request: Request) {
  const authResult = await authorizeActiveAppCardRoute(ROUTE_KEY);
  if (!authResult.ok) {
    return authResult.response;
  }
  const { ctx, auth } = authResult;
  const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? "";
  const publishedSlug = await loadPublishedSlug(ctx.env.WE_MET_DB, auth.account.id);
  if (publishedSlug && slug === publishedSlug) {
    const response = jsonOk({ status: "available" });
    return refreshSessionCookie(response, auth);
  }
  const fmt = slugFormatCheck(slug);
  if (!slug || fmt || !isValidSlug(slug)) {
    const response = jsonOk({
      status: "invalid",
      message: fmt || "Choose your link to publish.",
    });
    return refreshSessionCookie(response, auth);
  }
  if (isReservedSlug(slug)) {
    const response = jsonOk({ status: "reserved" });
    return refreshSessionCookie(response, auth);
  }
  const taken = await slugTakenByOther(ctx.env.WE_MET_DB, slug, auth.account.id);
  const response = jsonOk({ status: taken ? "taken" : "available" });
  return refreshSessionCookie(response, auth);
}
