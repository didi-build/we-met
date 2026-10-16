import { describe, expect, it } from "vitest";
import {
  resetGoogleJwksCacheForTests,
  verifyGoogleIdToken,
} from "@/app-auth/google-oauth";
import { generateTestRsaKeyPair, signTestIdToken } from "../helpers/google-id-token";

describe("verifyGoogleIdToken (unit)", () => {
  const clientId = "test-client";
  const nonce = "nonce-123";

  async function tokenWithPayload(payload: Record<string, unknown>) {
    const { publicJwk, privateKey } = await generateTestRsaKeyPair();
    const idToken = await signTestIdToken(privateKey, {
      kid: publicJwk.kid!,
      payload,
    });
    resetGoogleJwksCacheForTests();
    return verifyGoogleIdToken(
      idToken,
      { clientId, nonce },
      { loadJwks: async () => [publicJwk] },
    );
  }

  it("accepts a valid RS256 token", async () => {
    const claims = await tokenWithPayload({
      iss: "https://accounts.google.com",
      aud: clientId,
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce,
      email_verified: true,
      sub: "sub-1",
      email: "user@example.com",
    });
    expect(claims?.sub).toBe("sub-1");
  });

  it("rejects bad signature", async () => {
    const { publicJwk, privateKey } = await generateTestRsaKeyPair();
    const other = await generateTestRsaKeyPair();
    const idToken = await signTestIdToken(privateKey, {
      kid: publicJwk.kid!,
      payload: {
        iss: "https://accounts.google.com",
        aud: clientId,
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce,
        email_verified: true,
        sub: "sub-1",
        email: "user@example.com",
      },
    });
    resetGoogleJwksCacheForTests();
    const claims = await verifyGoogleIdToken(
      idToken,
      { clientId, nonce },
      { loadJwks: async () => [other.publicJwk] },
    );
    expect(claims).toBeNull();
  });

  it("rejects wrong aud, iss, exp, nonce, email_verified, and alg", async () => {
    expect(
      await tokenWithPayload({
        iss: "https://evil.com",
        aud: clientId,
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce,
        email_verified: true,
        sub: "s",
        email: "a@b.com",
      }),
    ).toBeNull();
    expect(
      await tokenWithPayload({
        iss: "https://accounts.google.com",
        aud: "wrong",
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce,
        email_verified: true,
        sub: "s",
        email: "a@b.com",
      }),
    ).toBeNull();
    expect(
      await tokenWithPayload({
        iss: "https://accounts.google.com",
        aud: clientId,
        exp: Math.floor(Date.now() / 1000) - 10,
        nonce,
        email_verified: true,
        sub: "s",
        email: "a@b.com",
      }),
    ).toBeNull();
    expect(
      await tokenWithPayload({
        iss: "https://accounts.google.com",
        aud: clientId,
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: "other",
        email_verified: true,
        sub: "s",
        email: "a@b.com",
      }),
    ).toBeNull();
    expect(
      await tokenWithPayload({
        iss: "https://accounts.google.com",
        aud: clientId,
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce,
        email_verified: false,
        sub: "s",
        email: "a@b.com",
      }),
    ).toBeNull();

    const { publicJwk, privateKey } = await generateTestRsaKeyPair();
    const badAlg = await signTestIdToken(privateKey, {
      kid: publicJwk.kid!,
      payload: {
        iss: "https://accounts.google.com",
        aud: clientId,
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce,
        email_verified: true,
        sub: "s",
        email: "a@b.com",
      },
    });
    const parts = badAlg.split(".");
    const header = btoa(JSON.stringify({ alg: "HS256", kid: publicJwk.kid }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const forged = `${header}.${parts[1]}.${parts[2]}`;
    resetGoogleJwksCacheForTests();
    expect(
      await verifyGoogleIdToken(
        forged,
        { clientId, nonce },
        { loadJwks: async () => [publicJwk] },
      ),
    ).toBeNull();
  });
});
