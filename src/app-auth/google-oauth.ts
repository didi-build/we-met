import { randomToken, sha256Base64Url } from "@/app-auth/crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export type GoogleIdTokenClaims = {
  sub: string;
  email: string;
  name?: string;
  email_verified: boolean;
  nonce?: string;
  aud: string;
  iss: string;
  exp: number;
};

type JwkKey = JsonWebKey & { kid?: string };

export type GoogleJwksLoader = () => Promise<JwkKey[]>;

let jwksCache: { keys: JwkKey[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000;

export function resetGoogleJwksCacheForTests(): void {
  jwksCache = null;
}

async function fetchGoogleJwksFromNetwork(): Promise<JwkKey[]> {
  let response: Response;
  try {
    response = await fetch(GOOGLE_JWKS_URL);
  } catch {
    return [];
  }
  if (!response.ok) {
    return [];
  }
  try {
    const payload = (await response.json()) as { keys?: JwkKey[] };
    return payload.keys ?? [];
  } catch {
    return [];
  }
}

async function loadGoogleJwks(
  loader?: GoogleJwksLoader,
  forceRefresh = false,
): Promise<JwkKey[]> {
  const now = Date.now();
  if (!forceRefresh && jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const keys = loader ? await loader() : await fetchGoogleJwksFromNetwork();
  if (keys.length > 0) {
    jwksCache = { keys, fetchedAt: now };
  }
  return keys;
}

export async function createPkcePair(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = randomToken(32);
  const challenge = await sha256Base64Url(verifier);
  return { verifier, challenge };
}

export function buildGoogleAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ idToken: string } | { error: "token_exchange_failed" }> {
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
    const json = (await response.json()) as { id_token?: string };
    if (!json.id_token) {
      return { error: "token_exchange_failed" };
    }
    return { idToken: json.id_token };
  } catch {
    return { error: "token_exchange_failed" };
  }
}

function decodeJwtPart(part: string): Uint8Array | null {
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function parseJsonUtf8(bytes: Uint8Array): unknown | null {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export async function verifyGoogleIdToken(
  idToken: string,
  expected: { clientId: string; nonce: string },
  options?: { loadJwks?: GoogleJwksLoader },
): Promise<GoogleIdTokenClaims | null> {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  const headerBytes = decodeJwtPart(headerB64);
  if (!headerBytes) {
    return null;
  }
  const header = parseJsonUtf8(headerBytes) as { alg?: string; kid?: string } | null;
  if (!header || header.alg !== "RS256" || !header.kid) {
    return null;
  }

  let keys = await loadGoogleJwks(options?.loadJwks);
  let jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    keys = await loadGoogleJwks(options?.loadJwks, true);
    jwk = keys.find((key) => key.kid === header.kid);
  }
  if (!jwk) {
    return null;
  }

  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    return null;
  }

  const payloadBytes = decodeJwtPart(payloadB64);
  const signatureBytes = decodeJwtPart(signatureB64);
  if (!payloadBytes || !signatureBytes) {
    return null;
  }

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      new Uint8Array(signatureBytes),
      signedData,
    );
  } catch {
    return null;
  }
  if (!valid) {
    return null;
  }

  const claims = parseJsonUtf8(payloadBytes) as GoogleIdTokenClaims | null;
  if (!claims) {
    return null;
  }
  if (!GOOGLE_ISSUERS.has(claims.iss)) {
    return null;
  }
  if (claims.aud !== expected.clientId) {
    return null;
  }
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) {
    return null;
  }
  if (claims.nonce !== expected.nonce) {
    return null;
  }
  if (!claims.email_verified) {
    return null;
  }
  if (!claims.sub || !claims.email) {
    return null;
  }
  return claims;
}

export function popupResultHtml(result: "ok" | "failed" | "canceled"): string {
  const payload = JSON.stringify({ type: "we-met-auth", result });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sign in</title></head><body><script>
try {
  if (window.opener) {
    window.opener.postMessage(${payload}, window.location.origin);
  }
} catch (_) {}
window.close();
</script></body></html>`;
}
