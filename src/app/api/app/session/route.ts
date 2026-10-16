import { sessionCookieValue } from "@/app-auth/cookies";
import { apiError, apiJson, apiNotFound, clientIp } from "@/app-auth/guards";
import { ensureAppApiHost, readAppAuthBindings } from "@/app-auth/route-context";
import { buildAppSessionJson } from "@/app-auth/session-response";
import { headers } from "next/headers";

const AUTH_ROUTE_KEY = "session";

export async function GET() {
  const ctx = await readAppAuthBindings();
  if (!ensureAppApiHost(ctx.hostname, ctx.hostConfig)) {
    return apiNotFound();
  }

  const headerList = await headers();
  const allowed = await ctx.authRateLimiter.check(AUTH_ROUTE_KEY, clientIp(headerList));
  if (!allowed) {
    return apiError("rate-limited", 429);
  }

  const built = await buildAppSessionJson(ctx.env.WE_MET_DB, ctx.sessionToken);
  const response = apiJson({ session: built.session }, { status: 200 });
  if (built.session && ctx.sessionToken && built.cookieMaxAgeSeconds !== undefined) {
    response.headers.append(
      "set-cookie",
      sessionCookieValue(ctx.sessionToken, built.cookieMaxAgeSeconds),
    );
  }
  return response;
}
