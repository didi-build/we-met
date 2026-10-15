import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
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

  it("rejects v1 tokens", () => {
    const payload = {
      v: 1,
      leadId: "lead-1",
      cardId: "card-1",
      cardSlug: "demo",
      visitorEmail: "visitor@example.com",
      exp: 1_700_000_000 + 3600,
      iat: 1_700_000_000,
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
    const token = `${payloadB64}.${sig}`;
    const verified = verifyDetailsToken(secret, token, 1_700_000_000);
    expect(verified.ok).toBe(false);
  });

  it("rejects tokens with missing or blank visitorName", () => {
    const missingName = createDetailsToken(
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
    const parts = missingName.split(".");
    const parsed = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    delete parsed.visitorName;
    const payloadB64 = Buffer.from(JSON.stringify(parsed)).toString("base64url");
    const sig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
    expect(verifyDetailsToken(secret, `${payloadB64}.${sig}`, 1_700_000_000).ok).toBe(
      false,
    );

    const blank = createDetailsToken(
      secret,
      {
        leadId: "lead-1",
        cardId: "card-1",
        cardSlug: "demo",
        visitorEmail: "visitor@example.com",
        visitorName: "   ",
      },
      1_700_000_000,
    );
    expect(verifyDetailsToken(secret, blank, 1_700_000_000).ok).toBe(false);
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
