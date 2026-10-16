export const SESSION_COOKIE_NAME = "__Host-wm_session";
export const OAUTH_COOKIE_NAME = "__Host-wm_oauth";

export const SESSION_SLIDING_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function parseCookieHeader(header: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) {
    return map;
  }
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    map.set(name, decodeURIComponent(value));
  }
  return map;
}

export function sessionCookieValue(token: string, maxAgeSeconds?: number): string {
  const maxAge = Math.max(
    0,
    Math.floor(maxAgeSeconds ?? SESSION_SLIDING_MAX_AGE_SECONDS),
  );
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

export function clearSessionCookieValue(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}

export function oauthCookieValue(state: string, maxAgeSeconds: number): string {
  return [
    `${OAUTH_COOKIE_NAME}=${encodeURIComponent(state)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
}

export function clearOAuthCookieValue(): string {
  return [
    `${OAUTH_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}
