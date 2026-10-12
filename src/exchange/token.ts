import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 1;
const TOKEN_TTL_SECONDS = 2 * 60 * 60;

export type DetailsTokenPayload = {
  v: number;
  leadId: string;
  cardId: string;
  cardSlug: string;
  visitorEmail: string;
  exp: number;
  iat: number;
};

function base64UrlEncode(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buf.toString("base64url");
}

function base64UrlDecode(data: string): Buffer {
  return Buffer.from(data, "base64url");
}

function signPayload(secret: string, payloadB64: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createDetailsToken(
  secret: string,
  payload: Omit<DetailsTokenPayload, "v" | "exp" | "iat">,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const full: DetailsTokenPayload = {
    v: TOKEN_VERSION,
    ...payload,
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(full));
  const sig = signPayload(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifyDetailsToken(
  secret: string,
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): { ok: true; payload: DetailsTokenPayload } | { ok: false } {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { ok: false };
  }
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) {
    return { ok: false };
  }

  const expectedSig = signPayload(secret, payloadB64);
  const sigBuf = base64UrlDecode(sig);
  const expectedBuf = base64UrlDecode(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false };
  }

  let parsed: DetailsTokenPayload;
  try {
    parsed = JSON.parse(
      base64UrlDecode(payloadB64).toString("utf8"),
    ) as DetailsTokenPayload;
  } catch {
    return { ok: false };
  }

  if (parsed.v !== TOKEN_VERSION) {
    return { ok: false };
  }
  if (typeof parsed.leadId !== "string" || typeof parsed.cardId !== "string") {
    return { ok: false };
  }
  if (
    typeof parsed.visitorEmail !== "string" ||
    typeof parsed.cardSlug !== "string" ||
    typeof parsed.exp !== "number"
  ) {
    return { ok: false };
  }
  if (parsed.exp <= nowSeconds) {
    return { ok: false };
  }

  return { ok: true, payload: parsed };
}
