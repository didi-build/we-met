import {
  clearOAuthCookieValue,
  parseCookieHeader,
  OAUTH_COOKIE_NAME,
  sessionCookieValue,
} from "@/app-auth/cookies";
import { constantTimeEqual } from "@/app-auth/crypto";
import {
  exchangeGoogleCode,
  popupResultHtml,
  verifyGoogleIdToken,
} from "@/app-auth/google-oauth";
import { apiNotFound } from "@/app-auth/guards";
import { redirectResponse } from "@/app-auth/redirect-response";
import { upsertAccountFromGoogle } from "@/app-auth/accounts";
import { ensureAppApiHost, readAppAuthBindings } from "@/app-auth/route-context";
import { consumeOAuthAttempt, createSession } from "@/app-auth/sessions";
import { appSpaPath, resolveAppOrigin } from "@/config/app-api-host";
import { clientIp } from "@/app-auth/guards";
import { headers } from "next/headers";

const AUTH_ROUTE_KEY = "google-callback";

function redirectWithAuthError(
  appOrigin: string,
  spaPath: string,
  error: "canceled" | "failed",
): Response {
  const url = new URL(spaPath, appOrigin);
  url.searchParams.set("auth_error", error);
  return redirectResponse(url.toString(), {
    setCookies: [clearOAuthCookieValue()],
  });
}

function oauthStatesMatch(cookieState: string | undefined, state: string): boolean {
  if (!cookieState) {
    return false;
  }
  return constantTimeEqual(cookieState, state);
}

export async function GET(request: Request) {
  try {
    const ctx = await readAppAuthBindings();
    if (!ensureAppApiHost(ctx.hostname, ctx.hostConfig)) {
      return apiNotFound();
    }

    const headerList = await headers();
    const allowed = await ctx.authRateLimiter.check(
      AUTH_ROUTE_KEY,
      clientIp(headerList),
    );
    if (!allowed) {
      return new Response(null, { status: 429 });
    }

    const clientId = ctx.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = ctx.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return new Response(null, { status: 404 });
    }

    const appOrigin = resolveAppOrigin(ctx.hostConfig, request.url, ctx.env);
    const spaPath = appSpaPath(ctx.hostConfig, ctx.hostname);
    const url = new URL(request.url);
    const oauthError = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    const cookies = parseCookieHeader(ctx.cookieHeader);
    const cookieState = cookies.get(OAUTH_COOKIE_NAME);

    if (oauthError === "access_denied") {
      const attempt =
        state && oauthStatesMatch(cookieState, state)
          ? await consumeOAuthAttempt(ctx.env.WE_MET_DB, state)
          : { ok: false as const };
      if (attempt.ok && attempt.mode === "popup") {
        const response = new Response(popupResultHtml("canceled"), {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          },
        });
        response.headers.append("set-cookie", clearOAuthCookieValue());
        return response;
      }
      return redirectWithAuthError(appOrigin, spaPath, "canceled");
    }

    if (!code || !state || !oauthStatesMatch(cookieState, state)) {
      return redirectWithAuthError(appOrigin, spaPath, "failed");
    }

    const attempt = await consumeOAuthAttempt(ctx.env.WE_MET_DB, state);
    if (!attempt.ok) {
      return redirectWithAuthError(appOrigin, spaPath, "failed");
    }

    const redirectUri = `${appOrigin}/api/auth/google/callback`;
    const tokens = await exchangeGoogleCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
      codeVerifier: attempt.pkceVerifier,
    });
    if ("error" in tokens) {
      return redirectWithAuthError(appOrigin, spaPath, "failed");
    }

    const claims = await verifyGoogleIdToken(tokens.idToken, {
      clientId,
      nonce: attempt.nonce,
    });
    if (!claims) {
      return redirectWithAuthError(appOrigin, spaPath, "failed");
    }

    const accountResult = await upsertAccountFromGoogle(ctx.env.WE_MET_DB, {
      sub: claims.sub,
      email: claims.email,
      name: claims.name ?? claims.email,
    });
    if (!accountResult.ok) {
      return redirectWithAuthError(appOrigin, spaPath, "failed");
    }

    const session = await createSession(ctx.env.WE_MET_DB, accountResult.account.id);

    if (attempt.mode === "popup") {
      const response = new Response(popupResultHtml("ok"), {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
      response.headers.append("set-cookie", sessionCookieValue(session.token));
      response.headers.append("set-cookie", clearOAuthCookieValue());
      return response;
    }

    return redirectResponse(new URL(spaPath, appOrigin).toString(), {
      setCookies: [sessionCookieValue(session.token), clearOAuthCookieValue()],
    });
  } catch {
    const ctx = await readAppAuthBindings().catch(() => null);
    if (!ctx) {
      return new Response(null, { status: 302, headers: { Location: "/" } });
    }
    const appOrigin = resolveAppOrigin(ctx.hostConfig, request.url, ctx.env);
    const spaPath = appSpaPath(ctx.hostConfig, ctx.hostname);
    return redirectWithAuthError(appOrigin, spaPath, "failed");
  }
}
