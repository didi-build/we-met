import {
  clearOAuthCookieValue,
  parseCookieHeader,
  OAUTH_COOKIE_NAME,
  sessionCookieValue,
} from "@/app-auth/cookies";
import {
  exchangeGoogleCode,
  popupResultHtml,
  verifyGoogleIdToken,
} from "@/app-auth/google-oauth";
import { apiNotFound } from "@/app-auth/guards";
import { upsertAccountFromGoogle } from "@/app-auth/accounts";
import { ensureAppApiHost, readAppAuthBindings } from "@/app-auth/route-context";
import { consumeOAuthAttempt, createSession } from "@/app-auth/sessions";
import { appSpaPath, resolveAppOrigin } from "@/config/app-api-host";

function redirectWithAuthError(
  appOrigin: string,
  spaPath: string,
  error: "canceled" | "failed",
): Response {
  const url = new URL(spaPath, appOrigin);
  url.searchParams.set("auth_error", error);
  const response = Response.redirect(url.toString(), 302);
  response.headers.set("cache-control", "no-store");
  response.headers.append("set-cookie", clearOAuthCookieValue());
  return response;
}

export async function GET(request: Request) {
  const ctx = await readAppAuthBindings();
  if (!ensureAppApiHost(ctx.hostname, ctx.hostConfig)) {
    return apiNotFound();
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
    const attempt = state ? await consumeOAuthAttempt(ctx.env.WE_MET_DB, state) : null;
    if (attempt?.ok && attempt.mode === "popup") {
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

  if (!code || !state || !cookieState || cookieState !== state) {
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

  const response = Response.redirect(new URL(spaPath, appOrigin).toString(), 302);
  response.headers.set("cache-control", "no-store");
  response.headers.append("set-cookie", sessionCookieValue(session.token));
  response.headers.append("set-cookie", clearOAuthCookieValue());
  return response;
}
