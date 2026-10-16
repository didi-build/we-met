import { sessionCookieValue } from "@/app-auth/cookies";
import {
  apiError,
  apiJson,
  apiNotFound,
  clientIp,
  guardMutationRequest,
} from "@/app-auth/guards";
import {
  isPreviewLoginRouteEnabled,
  verifyPreviewLoginSecret,
} from "@/app-auth/preview-login";
import { upsertPreviewTestAccount } from "@/app-auth/accounts";
import { ensureAppApiHost, readAppAuthBindings } from "@/app-auth/route-context";
import { createSession } from "@/app-auth/sessions";
import { headers } from "next/headers";

export async function POST(request: Request) {
  const ctx = await readAppAuthBindings();
  if (!ensureAppApiHost(ctx.hostname, ctx.hostConfig)) {
    return apiNotFound();
  }

  if (!isPreviewLoginRouteEnabled(ctx.env)) {
    return apiNotFound();
  }

  const headerList = await headers();
  const allowed = await ctx.authRateLimiter.check(
    "preview-login",
    clientIp(headerList),
  );
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("forbidden", 403);
  }

  const secret =
    typeof body === "object" &&
    body !== null &&
    "secret" in body &&
    typeof (body as { secret: unknown }).secret === "string"
      ? (body as { secret: string }).secret
      : "";

  const expected = ctx.env.WE_MET_PREVIEW_LOGIN_SECRET?.trim() ?? "";
  if (!verifyPreviewLoginSecret(secret, expected)) {
    return apiError("forbidden", 403);
  }

  const email = ctx.env.WE_MET_PREVIEW_LOGIN_EMAIL?.trim();
  if (!email) {
    return new Response(null, { status: 500 });
  }

  const account = await upsertPreviewTestAccount(ctx.env.WE_MET_DB, { email });
  const session = await createSession(ctx.env.WE_MET_DB, account.id);

  const response = apiJson(
    {
      session: {
        email: account.email,
        name: account.name,
        allowed: true,
      },
    },
    { status: 200 },
  );
  response.headers.append("set-cookie", sessionCookieValue(session.token));
  return response;
}
