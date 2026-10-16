import { base64UrlEncode } from "@/app-auth/crypto";

function encodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

export async function generateTestRsaKeyPair(): Promise<{
  publicJwk: JsonWebKey & { kid: string };
  privateKey: CryptoKey;
}> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = (await crypto.subtle.exportKey(
    "jwk",
    pair.publicKey,
  )) as JsonWebKey;
  const kid = "test-kid";
  return {
    publicJwk: { ...publicJwk, kid, alg: "RS256", use: "sig" },
    privateKey: pair.privateKey,
  };
}

export async function signTestIdToken(
  privateKey: CryptoKey,
  input: {
    kid: string;
    payload: Record<string, unknown>;
  },
): Promise<string> {
  const header = encodeJson({ alg: "RS256", typ: "JWT", kid: input.kid });
  const payload = encodeJson(input.payload);
  const signedData = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    signedData,
  );
  const sig = base64UrlEncode(new Uint8Array(signature));
  return `${header}.${payload}.${sig}`;
}
