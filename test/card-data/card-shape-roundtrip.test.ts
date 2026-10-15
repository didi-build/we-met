import { describe, expect, it } from "vitest";
import { D1CardRepository } from "@/card-data/d1-repository";
import { buildCardsLoadSql, newCardIdsForLoad } from "@/card-data/load-sql";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { splitSqlStatements } from "@/card-data/sql-statements";
import { exampleCardInput, exampleLoadFile } from "../helpers/example-card";
import { withIsolatedLocalD1 } from "../helpers/d1";

describe("card shape round-trip (integration)", () => {
  const card = exampleCardInput();

  it("round-trips links, contact.urls and copy through memory repository", async () => {
    const repo = new MemoryCardRepository();
    await repo.upsertCard({ ...card, slug: "memory-roundtrip" });
    const loaded = await repo.getBySlug("memory-roundtrip");
    expect(loaded?.links).toEqual(card.links);
    expect(loaded?.bookingLinks).toEqual(card.bookingLinks);
    expect(loaded?.contact.urls).toEqual(card.contact.urls);
    expect(loaded?.copy).toEqual(card.copy);
    expect(loaded?.name).toBe(card.name);
  });

  it("round-trips through D1 repository and load SQL", async () => {
    const slug = "d1-roundtrip";
    const input = { ...card, slug };
    const loadFile = { cards: [input], hostnames: [] };
    const sql = buildCardsLoadSql(loadFile, {
      updatedAt: "2026-10-11T12:00:00.000Z",
      newCardIds: newCardIdsForLoad(loadFile),
    });

    await withIsolatedLocalD1(async (db) => {
      const repo = new D1CardRepository(db);
      for (const statement of splitSqlStatements(sql)) {
        await db.prepare(statement).run();
      }
      const loaded = await repo.getBySlug(slug);
      expect(loaded?.bookingLinks.bookingUrl).toBe(input.bookingLinks.bookingUrl);
      expect(loaded?.links).toEqual(input.links);
      expect(loaded?.contact.urls).toEqual(input.contact.urls);
      expect(loaded?.copy).toEqual(input.copy);
    });
  });

  it("preserves special characters in nested strings after D1 round-trip", async () => {
    const slug = "special-chars";
    const input = {
      ...card,
      slug,
      contact: {
        ...card.contact,
        vcardNote: "Met at an event; Didi's note — demo 🎉",
      },
      copy: {
        ...card.copy,
        exchangeSheet: {
          ...card.copy.exchangeSheet,
          exchangeNotSavedPrefix: "Could not save ",
          exchangeNotSavedSuffix: " please try again",
        },
      },
      about: {
        title: "About",
        paragraphs: ["Paragraph one… with ellipsis.", "Paragraph two."],
      },
    };
    const loadFile = { cards: [input], hostnames: [] };
    const sql = buildCardsLoadSql(loadFile, {
      updatedAt: "2026-10-11T12:00:00.000Z",
      newCardIds: newCardIdsForLoad(loadFile),
    });

    await withIsolatedLocalD1(async (db) => {
      const repo = new D1CardRepository(db);
      for (const statement of splitSqlStatements(sql)) {
        await db.prepare(statement).run();
      }
      const loaded = await repo.getBySlug(slug);
      expect(loaded?.contact.vcardNote).toContain(";");
      expect(loaded?.contact.vcardNote).toContain("'");
      expect(loaded?.contact.vcardNote).toContain("🎉");
      expect(loaded?.about?.paragraphs[0]).toContain("…");
      expect(loaded?.copy.exchangeSheet.exchangeNotSavedPrefix).toBe("Could not save ");
      expect(loaded?.copy.exchangeSheet.exchangeNotSavedSuffix).toBe(
        " please try again",
      );
    });
  });

  it("keeps https booking and link urls", () => {
    expect(card.bookingLinks.bookingUrl).toBe("https://didi.build/book");
    expect(card.links?.website).toBe("https://didi.build");
    expect(card.contact.urls[0].url).toBe("https://didi.build");
  });

  it("parses the committed example file", () => {
    const file = exampleLoadFile();
    expect(file.cards).toHaveLength(1);
    expect(file.cards[0].slug).toBe("didi");
  });
});
