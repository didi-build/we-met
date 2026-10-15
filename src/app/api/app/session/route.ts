import { apiError, apiJson, apiNotFound, clientIp } from "@/app-auth/guards";
import { ensureAppApiHost, readAppAuthBindings } from "@/app-auth/route-context";
import { buildAppSessionJson } from "@/app-auth/session-response";
import { headers } from "next/headers";

export async function GET() {
  const ctx = await readAppAuthBindings();
  if (!ensureAppApiHost(ctx.hostname, ctx.hostConfig)) {
    return apiNotFound();
  }

  const headerList = await headers();
  const allowed = await ctx.authRateLimiter.check(clientIp(headerList));
  if (!allowed) {
    return apiError("rate-limited", 429);
  }

  const session = await buildAppSessionJson(ctx.env.WE_MET_DB, ctx.sessionToken);
  return apiJson({ session }, { status: 200 });
}
