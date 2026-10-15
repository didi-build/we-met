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

  it("falls back unknown variant to mono", () => {
    const raw = cloneLoadFile();
    const card = (raw.cards as Record<string, unknown>[])[0];
    card.variant = "purple";
    const parsed = parseCardsLoadFile(raw);
    expect(parsed.cards[0].variant).toBe("mono");
  });

  const cases: {
    label: string;
    mutate: (raw: Record<string, unknown>) => void;
    pattern: RegExp;
  }[] = [
    {
      label: "http fallbackUrl",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        card.fallbackUrl = "http://example.com";
      },
      pattern: /https/,
    },
    {
      label: "http public link url",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const links = card.links as { url: string }[];
        links[0].url = "http://x.com";
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
      label: "unknown link type",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const links = card.links as { type: string }[];
        links[0].type = "twitter";
      },
      pattern: /Invalid link type/,
    },
    {
      label: "too many public links",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const links = card.links as unknown[];
        while (links.length <= 8) {
          links.push({
            type: "website",
            label: "Site",
            url: "https://example.com/x",
          });
        }
      },
      pattern: /links exceeds max length/,
    },
    {
      label: "unknown key in links item",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const links = card.links as Record<string, unknown>[];
        links[0].extra = true;
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
        card.name = "bad\nname";
      },
      pattern: /Control characters/,
    },
    {
      label: "over-length name",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        card.name = "x".repeat(61);
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
      label: "too many about paragraphs",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const about = card.about as string[];
        while (about.length <= 4) {
          about.push("Another paragraph.");
        }
      },
      pattern: /about exceeds max length/,
    },
    {
      label: "empty bodyParagraphs",
      mutate: (raw) => {
        const card = (raw.cards as Record<string, unknown>[])[0];
        const followUp = (card.copy as { followUpEmail: Record<string, unknown> })
          .followUpEmail;
        followUp.bodyParagraphs = [];
      },
      pattern: /bodyParagraphs/,
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
