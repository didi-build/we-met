import { describe, expect, it } from "vitest";
import { createDetailsToken, verifyDetailsToken } from "@/exchange/token";

describe("details token (unit)", () => {
  const secret = "unit-test-secret";

  it("round-trips a valid token", () => {
    const token = createDetailsToken(
      secret,
      {
        leadId: "lead-1",
        cardId: "card-1",
        cardSlug: "demo",
        visitorEmail: "visitor@example.com",
        visitorName: "Alex",
      },
      1_700_000_000,
    );
    const verified = verifyDetailsToken(secret, token, 1_700_000_000);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.payload.cardSlug).toBe("demo");
    }
  });

  it("rejects expired tokens", () => {
    const token = createDetailsToken(
      secret,
      {
        leadId: "lead-1",
        cardId: "card-1",
        cardSlug: "demo",
        visitorEmail: "visitor@example.com",
        visitorName: "Alex",
      },
      1_700_000_000,
    );
    const verified = verifyDetailsToken(secret, token, 1_700_000_000 + 3 * 60 * 60);
    expect(verified.ok).toBe(false);
  });

  it("rejects tampered tokens", () => {
    const token = createDetailsToken(
      secret,
      {
        leadId: "lead-1",
        cardId: "card-1",
        cardSlug: "demo",
        visitorEmail: "visitor@example.com",
        visitorName: "Alex",
      },
      1_700_000_000,
    );
    const verified = verifyDetailsToken("wrong-secret", token, 1_700_000_000);
    expect(verified.ok).toBe(false);
  });
});
