import {
  clearContactsOAuthCookieValue,
  contactsSetupSuppressCookieValue,
  CONTACTS_OAUTH_COOKIE_NAME,
  parseCookieHeader,
} from "@/app-auth/cookies";
import { constantTimeEqual } from "@/app-auth/crypto";
import { readContactSenderAddresses } from "@/app-auth/contacts-setup-config";
import { consumeContactsOAuthAttempt } from "@/app-auth/contacts-oauth-attempts";
import { exchangeGoogleCodeForContactsAccessToken } from "@/app-auth/google-contacts-oauth";
import {
  saveContactsSetupCompletion,
  syncWeMetGoogleContact,
} from "@/app-auth/google-people-api";
import { apiNotFound, clientIp } from "@/app-auth/guards";
import { redirectResponse } from "@/app-auth/redirect-response";
import { ensureAppApiHost, readAppAuthBindings } from "@/app-auth/route-context";
import { loadAccountForSession } from "@/app-auth/sessions";
import { appSpaPath, resolveAppOrigin } from "@/config/app-api-host";
import { headers } from "next/headers";

const AUTH_ROUTE_KEY = "google-contacts-callback";

function contactsStatesMatch(cookieState: string | undefined, state: string): boolean {
  if (!cookieState) {
    return false;
  }
  return constantTimeEqual(cookieState, state);
}

function redirectToApp(
  appOrigin: string,
  spaPath: string,
  query: Record<string, string>,
  setCookies: string[],
): Response {
  const url = new URL(spaPath, appOrigin);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return redirectResponse(url.toString(), { setCookies });
}

export async function GET(request: Request) {
  const ctx = await readAppAuthBindings();
  if (!ensureAppApiHost(ctx.hostname, ctx.hostConfig)) {
    return apiNotFound();
  }

  const headerList = await headers();
  const allowed = await ctx.authRateLimiter.check(AUTH_ROUTE_KEY, clientIp(headerList));
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
  const cookieState = cookies.get(CONTACTS_OAUTH_COOKIE_NAME);
  const clearOAuth = [clearContactsOAuthCookieValue()];

  if (oauthError === "access_denied" || oauthError === "admin_enforced") {
    if (state && contactsStatesMatch(cookieState, state)) {
      await consumeContactsOAuthAttempt(ctx.env.WE_MET_DB, state);
    }
    return redirectToApp(appOrigin, spaPath, { contacts_setup: "declined" }, [
      ...clearOAuth,
      contactsSetupSuppressCookieValue(),
    ]);
  }

  if (!code || !state || !contactsStatesMatch(cookieState, state)) {
    return redirectToApp(
      appOrigin,
      spaPath,
      { contacts_setup: "declined" },
      clearOAuth,
    );
  }

  const attempt = await consumeContactsOAuthAttempt(ctx.env.WE_MET_DB, state);
  if (!attempt.ok) {
    return redirectToApp(
      appOrigin,
      spaPath,
      { contacts_setup: "declined" },
      clearOAuth,
    );
  }

  const redirectUri = `${appOrigin}/api/auth/google/contacts/callback`;
  const tokens = await exchangeGoogleCodeForContactsAccessToken({
    code,
    clientId,
    clientSecret,
    redirectUri,
    codeVerifier: attempt.pkceVerifier,
  });
  if ("error" in tokens) {
    return redirectToApp(
      appOrigin,
      spaPath,
      { contacts_setup: "declined" },
      clearOAuth,
    );
  }

  const senderAddresses = readContactSenderAddresses(ctx.env);
  const syncResult = await syncWeMetGoogleContact(tokens.accessToken, senderAddresses);

  if (!syncResult.ok) {
    return redirectToApp(
      appOrigin,
      spaPath,
      { contacts_setup: "declined" },
      clearOAuth,
    );
  }

  const account = await loadAccountForSession(ctx.env.WE_MET_DB, attempt.accountId);
  if (!account) {
    return redirectToApp(
      appOrigin,
      spaPath,
      { contacts_setup: "declined" },
      clearOAuth,
    );
  }

  await saveContactsSetupCompletion(
    ctx.env.WE_MET_DB,
    attempt.accountId,
    senderAddresses,
    account.contact_sender_addresses,
  );

  return redirectToApp(appOrigin, spaPath, { contacts_setup: "success" }, clearOAuth);
}
