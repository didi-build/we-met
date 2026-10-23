import {
  contactsOAuthCookieValue,
  parseCookieHeader,
  SESSION_COOKIE_NAME,
} from "@/app-auth/cookies";
import { randomToken } from "@/app-auth/crypto";
import { createPkcePair } from "@/app-auth/google-oauth";
import { buildGoogleContactsAuthUrl } from "@/app-auth/google-contacts-oauth";
import { isContactsSetupEligible } from "@/app-auth/contacts-setup-config";
import { createContactsOAuthAttempt } from "@/app-auth/contacts-oauth-attempts";
import { apiError, apiNotFound, clientIp } from "@/app-auth/guards";
import { redirectResponse } from "@/app-auth/redirect-response";
import { ensureAppApiHost, readAppAuthBindings } from "@/app-auth/route-context";
import { sessionAllowedForAccount } from "@/app-auth/accounts";
import { loadAccountForSession, validateAndTouchSession } from "@/app-auth/sessions";
import { resolveAppOrigin } from "@/config/app-api-host";
import { headers } from "next/headers";

const AUTH_ROUTE_KEY = "google-contacts-start";

export async function GET(request: Request) {
  const ctx = await readAppAuthBindings();
  if (!ensureAppApiHost(ctx.hostname, ctx.hostConfig)) {
    return apiNotFound();
  }

  const headerList = await headers();
  const allowed = await ctx.authRateLimiter.check(AUTH_ROUTE_KEY, clientIp(headerList));
  if (!allowed) {
    return apiError("rate-limited", 429);
  }

  const clientId = ctx.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = ctx.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return new Response(null, { status: 404 });
  }

  if (ctx.hostConfig.weMetEnv === "preview") {
    return new Response(null, { status: 404 });
  }

  const cookies = parseCookieHeader(ctx.cookieHeader);
  const sessionToken = cookies.get(SESSION_COOKIE_NAME);
  if (!sessionToken) {
    return apiError("unauthorized", 401);
  }

  const valid = await validateAndTouchSession(ctx.env.WE_MET_DB, sessionToken);
  if (!valid) {
    return apiError("unauthorized", 401);
  }

  const account = await loadAccountForSession(ctx.env.WE_MET_DB, valid.accountId);
  if (!account || !sessionAllowedForAccount(account)) {
    return apiError("forbidden", 403);
  }

  if (!isContactsSetupEligible(ctx.env, account.email)) {
    return apiError("forbidden", 403);
  }

  const state = randomToken(24);
  const { verifier, challenge } = await createPkcePair();

  await createContactsOAuthAttempt(ctx.env.WE_MET_DB, {
    state,
    accountId: account.id,
    pkceVerifier: verifier,
  });

  const appOrigin = resolveAppOrigin(ctx.hostConfig, request.url, ctx.env);
  const redirectUri = `${appOrigin}/api/auth/google/contacts/callback`;
  const authUrl = buildGoogleContactsAuthUrl({
    clientId,
    redirectUri,
    state,
    codeChallenge: challenge,
  });

  return redirectResponse(authUrl, {
    setCookies: [contactsOAuthCookieValue(state)],
  });
}
