import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createExchangeContactCardToken,
  exchangeContactCardSigningKey,
  verifyExchangeContactCardToken,
} from "@/exchange/exchange-contact-card-token";

describe("exchange contact card token (unit)", () => {
  const secret = "master-secret-for-tests";

  it("round-trips payload without expiry", () => {
    const token = createExchangeContactCardToken(secret, {
      leadId: "lead-abc",
      cardId: "card-1",
    });
    const verified = verifyExchangeContactCardToken(secret, token);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.payload.leadId).toBe("lead-abc");
      expect(verified.payload.cardId).toBe("card-1");
      expect(verified.payload).not.toHaveProperty("exp");
    }
  });

  it("accepts legacy v1 tokens that still carry cardSlug", () => {
    const signingKey = exchangeContactCardSigningKey(secret);
    const payloadB64 = Buffer.from(
      JSON.stringify({
        v: 1,
        leadId: "lead-legacy",
        cardId: "card-1",
        cardSlug: "old-slug",
      }),
      "utf8",
    ).toString("base64url");
    const sig = createHmac("sha256", signingKey).update(payloadB64).digest("base64url");
    const token = `${payloadB64}.${sig}`;
    const verified = verifyExchangeContactCardToken(secret, token);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.payload.cardSlug).toBe("old-slug");
    }
  });

  it("rejects tampered tokens and wrong master secret", () => {
    const token = createExchangeContactCardToken(secret, {
      leadId: "lead-abc",
      cardId: "card-1",
    });
    const tampered = `${token}x`;
    expect(verifyExchangeContactCardToken(secret, tampered).ok).toBe(false);
    expect(verifyExchangeContactCardToken("other-secret", token).ok).toBe(false);
  });
});
