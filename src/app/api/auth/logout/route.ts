import { clearSessionCookieValue } from "@/app-auth/cookies";
import {
  apiError,
  apiJson,
  apiNotFound,
  clientIp,
  guardMutationRequest,
} from "@/app-auth/guards";
import { ensureAppApiHost, readAppAuthBindings } from "@/app-auth/route-context";
import { deleteSessionByToken } from "@/app-auth/sessions";
import { headers } from "next/headers";

export async function POST(request: Request) {
  const ctx = await readAppAuthBindings();
  if (!ensureAppApiHost(ctx.hostname, ctx.hostConfig)) {
    return apiNotFound();
  }

  const headerList = await headers();
  const allowed = await ctx.authRateLimiter.check("logout", clientIp(headerList));
  if (!allowed) {
    return apiError("rate-limited", 429);
  }

  const blocked = guardMutationRequest(
    request,
    ctx.hostConfig,
    ctx.env,
    "application/json",
  );
  if (blocked) {
    return blocked;
  }

  if (ctx.sessionToken) {
    await deleteSessionByToken(ctx.env.WE_MET_DB, ctx.sessionToken);
  }

  const response = apiJson({}, { status: 200 });
  response.headers.append("set-cookie", clearSessionCookieValue());
  return response;
}
