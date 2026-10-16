import { apiError, clientIp, guardMutationRequest } from "@/app-auth/guards";
import { ensureAppApiHost, readAppAuthBindings } from "@/app-auth/route-context";
import { requireCardRouteAuth, withSessionCookie } from "@/app-card/route-auth";
import { headers } from "next/headers";

export async function readAppCardRouteContext() {
  const ctx = await readAppAuthBindings();
  if (!ensureAppApiHost(ctx.hostname, ctx.hostConfig)) {
    return { ok: false as const, response: new Response(null, { status: 404 }) };
  }
  return { ok: true as const, ctx };
}

export async function authorizeActiveAppCardRoute(routeKey: string) {
  const base = await readAppCardRouteContext();
  if (!base.ok) {
    return base;
  }
  const { ctx } = base;
  const headerList = await headers();
  const ipAllowed = await ctx.authRateLimiter.check(
    `app-card:${routeKey}`,
    clientIp(headerList),
  );
  if (!ipAllowed) {
    return { ok: false as const, response: apiError("rate-limited", 429) };
  }
  const auth = await requireCardRouteAuth(ctx.env.WE_MET_DB, ctx.sessionToken);
  if (!auth.ok) {
    return { ok: false as const, response: auth.response };
  }
  const allowed = await ctx.appRateLimiter.check(auth.account.id, routeKey);
  if (!allowed) {
    return { ok: false as const, response: apiError("rate-limited", 429) };
  }
  return { ok: true as const, ctx, auth };
}

export function guardAppMutation(
  request: Request,
  ctx: Awaited<ReturnType<typeof readAppAuthBindings>>,
  contentType: string,
): Response | null {
  return guardMutationRequest(request, ctx.hostConfig, ctx.env, contentType);
}

export function refreshSessionCookie(
  response: Response,
  auth: Extract<
    Awaited<ReturnType<typeof authorizeActiveAppCardRoute>>,
    { ok: true }
  >["auth"],
): Response {
  return withSessionCookie(
    response,
    auth.sessionToken,
    auth.session.cookieMaxAgeSeconds,
  );
}
