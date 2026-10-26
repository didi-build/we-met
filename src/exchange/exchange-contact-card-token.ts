import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 1;
const EXCHANGE_CONTACT_CARD_HKDF_INFO = "we-met.exchange-contact-card.v1";

export type ExchangeContactCardTokenPayload = {
  v: number;
  leadId: string;
  cardId: string;
  /** Legacy field on tokens minted before cardId-only lookup; not validated. */
  cardSlug?: string;
};

function base64UrlEncode(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buf.toString("base64url");
}

function base64UrlDecode(data: string): Buffer {
  return Buffer.from(data, "base64url");
}

/** Domain-separated signing key derived from `WE_MET_TOKEN_SECRET`. */
export function exchangeContactCardSigningKey(masterSecret: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", masterSecret, "", EXCHANGE_CONTACT_CARD_HKDF_INFO, 32),
  );
}

function signPayload(signingKey: Buffer, payloadB64: string): string {
  return createHmac("sha256", signingKey).update(payloadB64).digest("base64url");
}

export function createExchangeContactCardToken(
  masterSecret: string,
  payload: Pick<ExchangeContactCardTokenPayload, "leadId" | "cardId">,
): string {
  const signingKey = exchangeContactCardSigningKey(masterSecret);
  const full: ExchangeContactCardTokenPayload = {
    v: TOKEN_VERSION,
    ...payload,
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(full));
  const sig = signPayload(signingKey, payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifyExchangeContactCardToken(
  masterSecret: string,
  token: string,
): { ok: true; payload: ExchangeContactCardTokenPayload } | { ok: false } {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { ok: false };
  }
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) {
    return { ok: false };
  }

  const signingKey = exchangeContactCardSigningKey(masterSecret);
  const expectedSig = signPayload(signingKey, payloadB64);
  if (sig.length !== expectedSig.length) {
    return { ok: false };
  }
  if (!timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expectedSig, "utf8"))) {
    return { ok: false };
  }

  let parsed: ExchangeContactCardTokenPayload;
  try {
    parsed = JSON.parse(
      base64UrlDecode(payloadB64).toString("utf8"),
    ) as ExchangeContactCardTokenPayload;
  } catch {
    return { ok: false };
  }

  if (parsed.v !== TOKEN_VERSION) {
    return { ok: false };
  }
  if (typeof parsed.leadId !== "string" || typeof parsed.cardId !== "string") {
    return { ok: false };
  }
  if (!parsed.leadId.trim() || !parsed.cardId.trim()) {
    return { ok: false };
  }
  if (
    parsed.cardSlug !== undefined &&
    (typeof parsed.cardSlug !== "string" || !parsed.cardSlug.trim())
  ) {
    return { ok: false };
  }

  return { ok: true, payload: parsed };
}
