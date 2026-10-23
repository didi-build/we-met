import { describe, expect, it } from "vitest";
import { createDetailsToken } from "@/exchange/token";
import {
  isDetailsTokenExpired,
  readDetailsTokenExpSeconds,
} from "@/lib/hi-card/details-token-client";

describe("details-token-client (unit)", () => {
  it("reads exp from a valid token and detects expiry", () => {
    const now = 1_700_000_000;
    const token = createDetailsToken(
      "secret",
      {
        leadId: "lead-1",
        cardId: "card-1",
        cardSlug: "demo",
        visitorEmail: "visitor@example.com",
        visitorName: "Visitor",
      },
      now,
    );
    const exp = readDetailsTokenExpSeconds(token);
    expect(exp).toBe(now + 2 * 60 * 60);
    expect(isDetailsTokenExpired(token, now + 100)).toBe(false);
    expect(isDetailsTokenExpired(token, exp!)).toBe(true);
  });
});
