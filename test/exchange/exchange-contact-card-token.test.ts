import { describe, expect, it } from "vitest";
import {
  createExchangeContactCardToken,
  verifyExchangeContactCardToken,
} from "@/exchange/exchange-contact-card-token";

describe("exchange contact card token (unit)", () => {
  const secret = "master-secret-for-tests";

  it("round-trips payload without expiry", () => {
    const token = createExchangeContactCardToken(secret, {
      leadId: "lead-abc",
      cardId: "card-1",
      cardSlug: "demo",
    });
    const verified = verifyExchangeContactCardToken(secret, token);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.payload.leadId).toBe("lead-abc");
      expect(verified.payload.cardId).toBe("card-1");
      expect(verified.payload.cardSlug).toBe("demo");
      expect(verified.payload).not.toHaveProperty("exp");
    }
  });

  it("rejects tampered tokens and wrong master secret", () => {
    const token = createExchangeContactCardToken(secret, {
      leadId: "lead-abc",
      cardId: "card-1",
      cardSlug: "demo",
    });
    const tampered = `${token}x`;
    expect(verifyExchangeContactCardToken(secret, tampered).ok).toBe(false);
    expect(verifyExchangeContactCardToken("other-secret", token).ok).toBe(false);
  });
});
