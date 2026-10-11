import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCardsLoadFile } from "@/card-data/load-file";

function minimalCard(overrides: Record<string, unknown> = {}) {
  return {
    slug: "demo",
    variant: "green",
    displayName: "Demo",
    email: "demo@example.com",
    photoKey: null,
    footerLink: { label: "Site", url: "https://example.com" },
    pageCopy: {
      pageTitle: "Hi",
      emailFromName: "Demo",
      headshotAlt: "Demo",
      greetingName: "Demo",
      exchangeButton: "Exchange",
      bookLink: "Book",
    },
    contact: {
      name: {
        full: "Demo",
        family: "User",
        given: "Demo",
        nickname: "D",
      },
      org: "Org",
      title: "Title",
      email: "demo@example.com",
      phone: "+1",
      vcardNote: "Note",
    },
    exchangeCopy: { thanksMessage: "Thanks" },
    ...overrides,
  };
}

describe("parseCardsLoadFile (unit)", () => {
  it("parses the committed example file", () => {
    const raw = JSON.parse(readFileSync("data/cards.example.json", "utf8"));
    const file = parseCardsLoadFile(raw);
    expect(file.cards).toHaveLength(1);
    expect(file.cards[0].slug).toBe("demo");
  });

  it("rejects leadSinks in step 1", () => {
    expect(() =>
      parseCardsLoadFile({
        cards: [],
        hostnames: [],
        leadSinks: [],
      }),
    ).toThrow(/step 1/);
  });

  it("rejects non-https footerLink.url schemes", () => {
    expect(() =>
      parseCardsLoadFile({
        cards: [
          minimalCard({
            footerLink: { label: "x", url: "javascript:alert(1)" },
          }),
        ],
        hostnames: [],
      }),
    ).toThrow(/https/);
    expect(() =>
      parseCardsLoadFile({
        cards: [
          minimalCard({
            footerLink: { label: "x", url: "http://example.com" },
          }),
        ],
        hostnames: [],
      }),
    ).toThrow(/https/);
  });

  it("rejects invalid email fields", () => {
    expect(() =>
      parseCardsLoadFile({
        cards: [minimalCard({ email: "not-an-email" })],
        hostnames: [],
      }),
    ).toThrow(/email/);
  });

  it("rejects control characters in strings", () => {
    expect(() =>
      parseCardsLoadFile({
        cards: [minimalCard({ displayName: "bad\nline" })],
        hostnames: [],
      }),
    ).toThrow(/Control characters/);
  });

  it("rejects non-string exchangeCopy values", () => {
    expect(() =>
      parseCardsLoadFile({
        cards: [minimalCard({ exchangeCopy: { thanksMessage: 42 } })],
        hostnames: [],
      }),
    ).toThrow(/exchangeCopy values must be strings/);
  });
});
