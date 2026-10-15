import { describe, expect, it } from "vitest";
import { parseCardsLoadFile } from "@/card-data/load-file";
import { exampleLoadRaw } from "../helpers/example-card";

function cloneLoadFile(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(exampleLoadRaw())) as Record<string, unknown>;
}

function expectReject(mutate: (raw: Record<string, unknown>) => void, pattern: RegExp) {
  const raw = cloneLoadFile();
  mutate(raw);
  expect(() => parseCardsLoadFile(raw)).toThrow(pattern);
}

describe("parseCardsLoadFile validation (unit)", () => {
  it("accepts whitespace padding on exchangeNotSaved prefix and suffix", () => {
    const raw = cloneLoadFile();
    const card = (raw.cards as Record<string, unknown>[])[0];
    const copy = card.copy as Record<string, unknown>;
    const sheet = copy.exchangeSheet as Record<string, unknown>;
    sheet.exchangeNotSavedPrefix = "Could not save ";
    sheet.exchangeNotSavedSuffix = " please try again";
    const parsed = parseCardsLoadFile(raw);
    expect(parsed.cards[0].copy.exchangeSheet.exchangeNotSavedPrefix).toBe(
      "Could not save ",
    );
    expect(parsed.cards[0].copy.exchangeSheet.exchangeNotSavedSuffix).toBe(
      " please try again",
    );
  });

  const cases: {
    label: string;
    mutate: (raw: Record<string, unknown>) => void;
    pattern: RegExp;
  }[] = [
    {
      label: "http bookingUrl",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        (card.links as Record<string, unknown>).bookingUrl = "http://example.com";
      },
      pattern: /https/,
    },
    {
      label: "https: without slashes bookingUrl",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        (card.links as Record<string, unknown>).bookingUrl = "https:example.com";
      },
      pattern: /must start with https:\/\//,
    },
    {
      label: "whitespace in bookingUrl",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        (card.links as Record<string, unknown>).bookingUrl = "https://exa mple.com";
      },
      pattern: /whitespace/,
    },
    {
      label: "javascript footer url",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const footer = (card.links as { footer: Record<string, unknown>[] }).footer;
        footer[0].url = "javascript:alert(1)";
      },
      pattern: /https/,
    },
    {
      label: "http contact.urls",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        (card.contact as { urls: { url: string }[] }).urls[0].url = "http://x.com";
      },
      pattern: /https/,
    },
    {
      label: "unknown footer kind",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const footer = (card.links as { footer: Record<string, unknown>[] }).footer;
        footer[0].kind = "twitter";
      },
      pattern: /footer kind/,
    },
    {
      label: "too many footer items",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const links = card.links as { footer: unknown[] };
        while (links.footer.length <= 6) {
          links.footer.push({ kind: "site", label: "X", url: "https://example.com/x" });
        }
      },
      pattern: /footer must have/,
    },
    {
      label: "unknown key in links",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        (card.links as Record<string, unknown>).extra = true;
      },
      pattern: /Unknown key in links/,
    },
    {
      label: "unknown key in footer item",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const footer = (card.links as { footer: Record<string, unknown>[] }).footer;
        footer[0].extra = true;
      },
      pattern: /Unknown key/,
    },
    {
      label: "unknown key in contact.urls item",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const urls = (card.contact as { urls: Record<string, unknown>[] }).urls;
        urls[0].extra = true;
      },
      pattern: /Unknown key/,
    },
    {
      label: "unknown key in copy",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        (card.copy as Record<string, unknown>).extra = true;
      },
      pattern: /Unknown key in copy/,
    },
    {
      label: "missing copy.about.title",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const about = (card.copy as { about: Record<string, unknown> }).about;
        delete about.title;
      },
      pattern: /copy.about.title/,
    },
    {
      label: "non-string copy leaf",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        (card.copy as Record<string, unknown>).thanksMessage = 42;
      },
      pattern: /thanksMessage/,
    },
    {
      label: "control character in string",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        card.displayName = "bad\nname";
      },
      pattern: /Control characters/,
    },
    {
      label: "over-length copy leaf",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        (card.copy as Record<string, unknown>).thanksMessage = "x".repeat(1001);
      },
      pattern: /exceeds max length/,
    },
    {
      label: "bad exchangeNotSavedEmail",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const sheet = (card.copy as { exchangeSheet: Record<string, unknown> })
          .exchangeSheet;
        sheet.exchangeNotSavedEmail = "not-an-email";
      },
      pattern: /email/,
    },
    {
      label: "invalid placeholder token",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        (card.copy as Record<string, unknown>).thanksMessage = "Hi {name}";
      },
      pattern: /Invalid placeholder/,
    },
    {
      label: "whitespace-only string",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        (card.copy as Record<string, unknown>).thanksMessage = "   ";
      },
      pattern: /non-whitespace/,
    },
    {
      label: "empty expandedParagraphs",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const about = (card.copy as { about: Record<string, unknown> }).about;
        about.expandedParagraphs = [];
      },
      pattern: /expandedParagraphs must have at least/,
    },
    {
      label: "empty chips",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const about = (card.copy as { about: Record<string, unknown> }).about;
        about.chips = [];
      },
      pattern: /chips must have at least/,
    },
    {
      label: "bookLink without bookingUrl",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const links = card.links as Record<string, unknown>;
        delete links.bookingUrl;
      },
      pattern: /links\.bookingUrl is required when pageCopy\.bookLink/,
    },
  ];

  for (const { label, mutate, pattern } of cases) {
    it(`rejects ${label}`, () => {
      expectReject(mutate, pattern);
    });
  }

  it("rejects leadSinks at the file root", () => {
    const raw = cloneLoadFile();
    raw.leadSinks = [];
    expect(() => parseCardsLoadFile(raw)).toThrow(/each card object/);
  });
});
