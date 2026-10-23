import { contactsOAuthScope } from "@/app-auth/contacts-setup-config";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export function buildGoogleContactsAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: contactsOAuthScope(),
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    include_granted_scopes: "true",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type GoogleAccessTokenExchangeResult =
  | { accessToken: string }
  | { error: "token_exchange_failed" | "missing_contacts_scope" };

export function accessTokenResponseIncludesContactsScope(
  scope: string | undefined,
): boolean {
  if (!scope?.trim()) {
    return false;
  }
  const required = contactsOAuthScope();
  return scope.split(/\s+/).includes(required);
}

export async function exchangeGoogleCodeForContactsAccessToken(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<GoogleAccessTokenExchangeResult> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });

  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    return { error: "token_exchange_failed" };
  }

  if (!response.ok) {
    return { error: "token_exchange_failed" };
  }

  try {
    const json = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
    };
    if (!json.access_token) {
      return { error: "token_exchange_failed" };
    }
    if (!accessTokenResponseIncludesContactsScope(json.scope)) {
      return { error: "missing_contacts_scope" };
    }
    if (json.refresh_token) {
      return { error: "token_exchange_failed" };
    }
    return { accessToken: json.access_token };
  } catch {
    return { error: "token_exchange_failed" };
  }
}
