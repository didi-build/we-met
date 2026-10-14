import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createGmailEmailSender,
  getGmailAccessToken,
  parseServiceAccountJson,
  resetGmailTokenCacheForTests,
} from "@/email/gmail-sender";
import { FollowupEmailError } from "@/email/followup-email-error";
import { generateTestServiceAccount } from "../helpers/gmail-test-service-account";

const PEM_PRIVATE_BEGIN = ["-----BEGIN", "PRIVATE", "KEY-----"].join(" ");
const PEM_PRIVATE_END = ["-----END", "PRIVATE", "KEY-----"].join(" ");

function base64UrlDecodeToString(raw: string): string {
  let b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) {
    b64 += "=";
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function decodeJwtPayload(assertion: string): Record<string, unknown> {
  const parts = assertion.split(".");
  expect(parts).toHaveLength(3);
  return JSON.parse(base64UrlDecodeToString(parts[1])) as Record<string, unknown>;
}

async function verifyJwtSignature(jwt: string, publicKey: CryptoKey): Promise<boolean> {
  const [encodedHeader, encodedPayload, encodedSignature] = jwt.split(".");
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const sigBytes = base64UrlToBytes(encodedSignature);
  const signature = new Uint8Array(sigBytes.length);
  signature.set(sigBytes);
  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    new TextEncoder().encode(signingInput),
  );
}

function base64UrlToBytes(value: string): Uint8Array {
  let b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) {
    b64 += "=";
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

describe("gmail sender (unit)", () => {
  beforeEach(() => {
    resetGmailTokenCacheForTests();
  });

  it("parses valid service account JSON", async () => {
    const { json, clientEmail, privateKeyPem } = await generateTestServiceAccount();
    const parsed = parseServiceAccountJson(json);
    expect(parsed.client_email).toBe(clientEmail);
    expect(parsed.private_key).toBe(privateKeyPem);
  });

  it("builds JWT with expected claims and valid signature", async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const bytes = new Uint8Array(pkcs8);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    const body = btoa(binary);
    const lines = [PEM_PRIVATE_BEGIN];
    for (let i = 0; i < body.length; i += 64) {
      lines.push(body.slice(i, i + 64));
    }
    lines.push(PEM_PRIVATE_END);
    const privateKeyPem = lines.join("\n");
    const clientEmail = "svc@test-project.iam.gserviceaccount.com";
    const json = JSON.stringify({
      client_email: clientEmail,
      private_key: privateKeyPem,
    });
    const sender = "owner@example.com";
    let capturedAssertion = "";
    const fetchFn = vi.fn(async (_url, init) => {
      const body = new URLSearchParams(init?.body as string);
      capturedAssertion = body.get("assertion") ?? "";
      return new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 3600 }),
        { status: 200 },
      );
    });

    await getGmailAccessToken({
      serviceAccountJson: json,
      senderEmail: sender,
      fetchFn,
    });

    const payload = decodeJwtPayload(capturedAssertion);
    expect(payload.iss).toBe(clientEmail);
    expect(payload.sub).toBe(sender);
    expect(payload.scope).toBe("https://www.googleapis.com/auth/gmail.send");
    expect(payload.aud).toBe("https://oauth2.googleapis.com/token");
    expect(await verifyJwtSignature(capturedAssertion, keyPair.publicKey)).toBe(true);
  });

  it("returns gmail_token_http_<status> on failed token response", async () => {
    const { json } = await generateTestServiceAccount();
    const fetchFn = vi.fn(async () => new Response("denied", { status: 401 }));
    await expect(
      getGmailAccessToken({
        serviceAccountJson: json,
        senderEmail: "owner@example.com",
        fetchFn,
      }),
    ).rejects.toMatchObject({ code: "gmail_token_http_401" });
  });

  it("returns gmail_token_missing_access_token when token body omits access_token", async () => {
    const { json } = await generateTestServiceAccount();
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ expires_in: 3600 }), { status: 200 }),
    );
    await expect(
      getGmailAccessToken({
        serviceAccountJson: json,
        senderEmail: "owner@example.com",
        fetchFn,
      }),
    ).rejects.toMatchObject({ code: "gmail_token_missing_access_token" });
  });

  it("sends with bearer token and raw field; maps send HTTP errors", async () => {
    const { json } = await generateTestServiceAccount();
    const fetchFn = vi.fn(async (url, init) => {
      if (String(url).includes("oauth2.googleapis.com")) {
        return new Response(
          JSON.stringify({ access_token: "send-token", expires_in: 3600 }),
          { status: 200 },
        );
      }
      expect(init?.headers).toMatchObject({
        authorization: "Bearer send-token",
      });
      const body = JSON.parse(init?.body as string) as { raw?: string };
      expect(typeof body.raw).toBe("string");
      return new Response("fail", { status: 503 });
    });

    const sender = createGmailEmailSender({
      serviceAccountJson: json,
      senderEmail: "owner@example.com",
      fetchFn,
    });

    await expect(
      sender.send({
        from: "owner@example.com",
        to: "visitor@example.com",
        subject: "Hi",
        textPlain: "plain",
        textHtml: "<p>html</p>",
      }),
    ).rejects.toMatchObject({ code: "gmail_send_http_503" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("caches access token within lifetime", async () => {
    const { json } = await generateTestServiceAccount();
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ access_token: "cached", expires_in: 3600 }), {
          status: 200,
        }),
    );

    const config = {
      serviceAccountJson: json,
      senderEmail: "owner@example.com",
      fetchFn,
    };
    await getGmailAccessToken(config);
    await getGmailAccessToken(config);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("maps network failures to gmail_network_error", async () => {
    const { json } = await generateTestServiceAccount();
    const fetchFn = vi.fn(async () => {
      throw new TypeError("network down");
    });
    await expect(
      getGmailAccessToken({
        serviceAccountJson: json,
        senderEmail: "owner@example.com",
        fetchFn,
      }),
    ).rejects.toBeInstanceOf(FollowupEmailError);
    await expect(
      getGmailAccessToken({
        serviceAccountJson: json,
        senderEmail: "owner@example.com",
        fetchFn,
      }),
    ).rejects.toMatchObject({ code: "gmail_network_error" });
  });
});
