import { buildRawEmailMessage } from "@/email/mime-message";
import type { EmailSender, OutboundEmail } from "@/email/types";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export type GmailServiceAccountConfig = {
  serviceAccountJson: string;
  senderEmail: string;
};

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
};

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

let tokenCache: TokenCache | null = null;

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const PEM_PRIVATE_BEGIN = ["-----BEGIN", "PRIVATE", "KEY-----"].join(" ");
const PEM_PRIVATE_END = ["-----END", "PRIVATE", "KEY-----"].join(" ");

function pemToPkcs8Der(pem: string): ArrayBuffer {
  const normalized = pem
    .replaceAll(PEM_PRIVATE_BEGIN, "")
    .replaceAll(PEM_PRIVATE_END, "")
    .replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function signJwt(
  payload: Record<string, string | number>,
  privateKeyPem: string,
): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8Der(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export function parseServiceAccountJson(raw: string): ServiceAccountKey {
  const parsed = JSON.parse(raw) as unknown;
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as ServiceAccountKey).client_email !== "string" ||
    typeof (parsed as ServiceAccountKey).private_key !== "string"
  ) {
    throw new Error("gmail_invalid_service_account_json");
  }
  return parsed as ServiceAccountKey;
}

export function resetGmailTokenCacheForTests(): void {
  tokenCache = null;
}

export async function getGmailAccessToken(
  config: GmailServiceAccountConfig,
): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs > now + 60_000) {
    return tokenCache.accessToken;
  }

  const account = parseServiceAccountJson(config.serviceAccountJson);
  const issuedAt = Math.floor(now / 1000);
  const jwt = await signJwt(
    {
      iss: account.client_email,
      sub: config.senderEmail,
      scope: GMAIL_SEND_SCOPE,
      aud: TOKEN_AUDIENCE,
      iat: issuedAt,
      exp: issuedAt + 3600,
    },
    account.private_key,
  );

  const response = await fetch(TOKEN_AUDIENCE, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`gmail_token_http_${response.status}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    throw new Error("gmail_token_missing_access_token");
  }

  const expiresInSec = payload.expires_in ?? 3600;
  tokenCache = {
    accessToken: payload.access_token,
    expiresAtMs: now + expiresInSec * 1000,
  };

  return payload.access_token;
}

export function createGmailEmailSender(config: GmailServiceAccountConfig): EmailSender {
  return {
    async send(message: OutboundEmail): Promise<void> {
      const accessToken = await getGmailAccessToken(config);
      const raw = buildRawEmailMessage(message);
      const response = await fetch(GMAIL_SEND_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });

      if (!response.ok) {
        throw new Error(`gmail_send_http_${response.status}`);
      }
    },
  };
}
