import { describe, expect, it } from "vitest";
import { buildCardEmailSnapshot } from "@/exchange/card-snapshot";
import { parseVisitorFollowupMessage } from "@/followup-email-consumer/validate";
import { exampleCardInput } from "../helpers/example-card";
import type { CardRecord } from "@/card-data/types";

function cardRecord(overrides: Partial<CardRecord> = {}): CardRecord {
  const input = exampleCardInput();
  return {
    id: "test-id",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
    ...overrides,
  };
}

describe("card email snapshot (unit)", () => {
  it("omits links and copy; parseVisitorFollowupMessage accepts the snapshot", () => {
    const snapshot = buildCardEmailSnapshot(
      cardRecord({
        alternate: undefined,
        bookingLinks: { bookingUrl: "" },
        slug: "solo",
      }),
    );
    expect(snapshot).not.toHaveProperty("links");
    expect(snapshot).not.toHaveProperty("copy");

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
        card: snapshot,
      }),
    ).not.toBeNull();
  });

  it("accepts snapshot when alternate is present on the card record", () => {
    const snapshot = buildCardEmailSnapshot(
      cardRecord({
        alternate: { url: "https://didi.build/book", label: "book" },
        bookingLinks: { bookingUrl: "https://didi.build/book" },
      }),
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
        card: snapshot,
      }),
    ).not.toBeNull();
  });
});
