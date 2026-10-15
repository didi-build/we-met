import { describe, expect, it } from "vitest";
import {
  buildCardEmailSnapshot,
  resolveCardBookingUrl,
} from "@/exchange/card-snapshot";
import { parseVisitorFollowupMessage } from "@/followup-email-consumer/validate";
import { exampleCardInput } from "../helpers/example-card";
import type { CardRecord } from "@/card-data/types";

const baseUrl = "https://we-met.link";

function cardRecord(overrides: Partial<CardRecord> = {}): CardRecord {
  const input = exampleCardInput();
  return {
    id: "test-id",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
    ...overrides,
  };
}

describe("card email snapshot booking URL (unit)", () => {
  it("uses alternate.url when bookingLinks is empty", () => {
    const card = cardRecord({
      bookingLinks: { bookingUrl: "" },
      alternate: { url: "https://didi.build/book", label: "book" },
    });
    expect(resolveCardBookingUrl(card, baseUrl)).toBe("https://didi.build/book");
  });

  it("falls back to the public card page when alternate is absent", () => {
    const card = cardRecord({
      slug: "didi",
      bookingLinks: { bookingUrl: "" },
      alternate: undefined,
    });
    expect(resolveCardBookingUrl(card, baseUrl)).toBe("https://we-met.link/hi/didi");
  });

  it("parseVisitorFollowupMessage accepts snapshot with and without alternate", () => {
    const withAlternate = buildCardEmailSnapshot(
      cardRecord({
        alternate: { url: "https://didi.build/book", label: "book" },
        bookingLinks: { bookingUrl: "https://didi.build/book" },
      }),
      baseUrl,
    );
    const withoutAlternate = buildCardEmailSnapshot(
      cardRecord({
        alternate: undefined,
        bookingLinks: { bookingUrl: "" },
        slug: "solo",
      }),
      baseUrl,
    );

    const lead = {
      leadId: "lead-1",
      submittedAt: "2026-10-12T00:00:00.000Z",
      environment: "preview",
      isTestLead: true,
      name: "Alex",
      email: "alex@example.com",
      phone: null,
    };

    expect(
      parseVisitorFollowupMessage({
        type: "visitor_followup",
        lead,
        card: withAlternate,
      }),
    ).not.toBeNull();
    const parsed = parseVisitorFollowupMessage({
      type: "visitor_followup",
      lead,
      card: withoutAlternate,
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.card.links.bookingUrl).toBe("https://we-met.link/hi/solo");
  });
});
