import { describe, expect, it } from "vitest";
import { D1CardRepository } from "@/card-data/d1-repository";
import {
  buildCardsLoadSql,
  escapeSqlStringLiteral,
  newCardIdsForLoad,
} from "@/card-data/load-sql";
import type { CardLoadInput, CardsLoadFile } from "@/card-data/types";
import { withIsolatedLocalD1 } from "../helpers/d1";

function sampleCard(overrides: Partial<CardLoadInput> = {}): CardLoadInput {
  return {
    slug: "apostrophe",
    variant: "green",
    displayName: "Didi's Café",
    email: "hello@example.com",
    photoKey: null,
    footerLink: {
      label: "Site — 日本",
      url: "https://example.com/path?q=it's",
    },
    pageCopy: {
      pageTitle: "Hi",
      emailFromName: "Didi",
      headshotAlt: "Didi",
      greetingName: "Didi",
      exchangeButton: "Exchange",
      bookLink: "Book",
    },
    contact: {
      name: {
        full: "Didi's Name",
        family: "Name",
        given: "Didi",
        nickname: "D",
      },
      org: "Org",
      title: "Title",
      email: "hello@example.com",
      phone: "+1-555-0100",
      vcardNote: "Note",
    },
    exchangeCopy: { thanksMessage: "Thanks, {firstName}." },
    ...overrides,
  };
}

describe("load SQL (unit)", () => {
  it("escapes apostrophes in SQL literals", () => {
    expect(escapeSqlStringLiteral("Didi's")).toBe("'Didi''s'");
  });

  it("matches D1CardRepository round-trip for unicode and apostrophes", async () => {
    const card = sampleCard();
    const loadFile: CardsLoadFile = { cards: [card], hostnames: [] };
    const updatedAt = "2026-10-11T12:00:00.000Z";
    const newCardIds = newCardIdsForLoad(loadFile);
    const sql = buildCardsLoadSql(loadFile, { updatedAt, newCardIds });

    await withIsolatedLocalD1(async (db) => {
      const repo = new D1CardRepository(db);
      for (const chunk of sql.split(";")) {
        const statement = chunk.trim();
        if (statement) {
          await db.prepare(statement).run();
        }
      }

      const fromSql = await repo.getBySlug(card.slug);
      expect(fromSql?.displayName).toBe(card.displayName);
      expect(fromSql?.footerLink).toEqual(card.footerLink);
      expect(fromSql?.contact.name.full).toBe(card.contact.name.full);
      expect(fromSql?.exchangeCopy).toEqual(card.exchangeCopy);
    });
  });
});
