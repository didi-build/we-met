import { describe, expect, it } from "vitest";
import { D1CardRepository } from "@/card-data/d1-repository";
import {
  buildCardsLoadSql,
  escapeSqlStringLiteral,
  newCardIdsForLoad,
} from "@/card-data/load-sql";
import { splitSqlStatements } from "@/card-data/sql-statements";
import { exampleCardInput } from "../helpers/example-card";
import { withIsolatedLocalD1 } from "../helpers/d1";

describe("load SQL (unit)", () => {
  it("escapes apostrophes in SQL literals", () => {
    expect(escapeSqlStringLiteral("Didi's")).toBe("'Didi''s'");
  });

  it("matches D1CardRepository round-trip for example card shape", async () => {
    const card = { ...exampleCardInput(), slug: "sql-apostrophe" };
    const loadFile = { cards: [card], hostnames: [] };
    const updatedAt = "2026-10-11T12:00:00.000Z";
    const sql = buildCardsLoadSql(loadFile, {
      updatedAt,
      newCardIds: newCardIdsForLoad(loadFile),
    });

    await withIsolatedLocalD1(async (db) => {
      const repo = new D1CardRepository(db);
      for (const statement of splitSqlStatements(sql)) {
        await db.prepare(statement).run();
      }
      const fromSql = await repo.getBySlug(card.slug);
      expect(fromSql?.links).toEqual(card.links);
      expect(fromSql?.contact.urls).toEqual(card.contact.urls);
      expect(fromSql?.copy).toEqual(card.copy);
    });
  });
});
