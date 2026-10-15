import { oauthCookieValue } from "@/app-auth/cookies";
import { randomToken } from "@/app-auth/crypto";
import { buildGoogleAuthUrl, createPkcePair } from "@/app-auth/google-oauth";
import { apiNotFound, clientIp } from "@/app-auth/guards";
import { ensureAppApiHost, readAppAuthBindings } from "@/app-auth/route-context";
import { createOAuthAttempt, type OAuthAttemptMode } from "@/app-auth/sessions";
import { resolveAppOrigin } from "@/config/app-api-host";
import { headers } from "next/headers";

const OAUTH_COOKIE_MAX_AGE = 10 * 60;

function parseMode(value: string | null): OAuthAttemptMode {
  return value === "popup" ? "popup" : "redirect";
}

export async function GET(request: Request) {
  const ctx = await readAppAuthBindings();
  if (!ensureAppApiHost(ctx.hostname, ctx.hostConfig)) {
    return apiNotFound();
  }

  const headerList = await headers();
  const allowed = await ctx.authRateLimiter.check(clientIp(headerList));
  if (!allowed) {
    return new Response(null, { status: 429 });
  }

  const clientId = ctx.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = ctx.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return new Response(null, { status: 404 });
  }

  if (ctx.hostConfig.weMetEnv === "preview") {
    return new Response(null, { status: 404 });
  }

  const url = new URL(request.url);
  const mode = parseMode(url.searchParams.get("mode"));
  const state = randomToken(24);
  const nonce = randomToken(24);
  const { verifier, challenge } = await createPkcePair();

  await createOAuthAttempt(ctx.env.WE_MET_DB, {
    state,
    nonce,
    pkceVerifier: verifier,
    mode,
  });

  const appOrigin = resolveAppOrigin(ctx.hostConfig, request.url, ctx.env);
  const redirectUri = `${appOrigin}/api/auth/google/callback`;
  const authUrl = buildGoogleAuthUrl({
    clientId,
    redirectUri,
    state,
    nonce,
    codeChallenge: challenge,
  });

  const response = Response.redirect(authUrl, 302);
  response.headers.set("cache-control", "no-store");
  response.headers.append("set-cookie", oauthCookieValue(state, OAUTH_COOKIE_MAX_AGE));
  return response;
}
