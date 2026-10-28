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

async function previewLoginRouteGuard(): Promise<
  Response | Awaited<ReturnType<typeof readAppAuthBindings>>
> {
  const ctx = await readAppAuthBindings();
  if (!ensureAppApiHost(ctx.hostname, ctx.hostConfig)) {
    return apiNotFound();
  }
  if (!isPreviewLoginRouteEnabled(ctx.env)) {
    return apiNotFound();
  }
  return ctx;
}

async function previewLoginNonPostResponse(): Promise<Response> {
  const guardResult = await previewLoginRouteGuard();
  if (guardResult instanceof Response) {
    return guardResult;
  }
  // Preview login is POST-only; app API host and env already passed the guard.
  return apiNotFound();
}

export async function GET() {
  return previewLoginNonPostResponse();
}

export async function HEAD() {
  return previewLoginNonPostResponse();
}

export async function PUT() {
  return previewLoginNonPostResponse();
}

export async function PATCH() {
  return previewLoginNonPostResponse();
}

export async function DELETE() {
  return previewLoginNonPostResponse();
}

export async function OPTIONS() {
  return previewLoginNonPostResponse();
}

export async function POST(request: Request) {
  const guardResult = await previewLoginRouteGuard();
  if (guardResult instanceof Response) {
    return guardResult;
  }
  const ctx = guardResult;

  const headerList = await headers();
  const allowed = await ctx.authRateLimiter.check(
    "preview-login",
    clientIp(headerList),
  );
  if (!allowed) {
    return apiError("rate-limited", 429);
  }

  const mutationBlocked = guardMutationRequest(
    request,
    ctx.hostConfig,
    ctx.env,
    "application/json",
  );
  if (mutationBlocked) {
    return mutationBlocked;
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
        contactsSetup: { visible: false },
      },
    },
    { status: 200 },
  );
  response.headers.append("set-cookie", sessionCookieValue(session.token));
  return response;
}
