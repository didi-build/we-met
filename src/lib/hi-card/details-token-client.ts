/** Client-side expiry read for exchange details tokens (no signature verification). */

function base64UrlToJson(payloadB64: string): unknown {
  const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const withPad = padded + "=".repeat(padLen);
  const json = atob(withPad);
  return JSON.parse(json) as unknown;
}

export function readDetailsTokenExpSeconds(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0]) {
    return null;
  }
  try {
    const parsed = base64UrlToJson(parts[0]) as { exp?: unknown };
    return typeof parsed.exp === "number" ? parsed.exp : null;
  } catch {
    return null;
  }
}

export function isDetailsTokenExpired(
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const exp = readDetailsTokenExpSeconds(token);
  if (exp === null) {
    return true;
  }
  return nowSeconds >= exp;
}
