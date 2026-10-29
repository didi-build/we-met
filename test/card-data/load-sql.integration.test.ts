import { describe, expect, it } from "vitest";
import { D1CardRepository } from "@/card-data/d1-repository";
import {
  assertAccountsExistForLoad,
  buildCardsLoadSql,
  escapeSqlStringLiteral,
  newAccountIdsForLoad,
  newCardIdsForLoad,
} from "@/card-data/load-sql";
import { splitSqlStatements } from "@/card-data/sql-statements";
import { exampleCardInput } from "../helpers/example-card";
import { withIsolatedLocalD1 } from "../helpers/d1";

describe("load SQL (unit)", () => {
  it("escapes apostrophes in SQL literals", () => {
    expect(escapeSqlStringLiteral("Didi's")).toBe("'Didi''s'");
  });

  it("loads cards onto a pre-existing account without inserting the account row", async () => {
    const accountId = "existing-account-0001";
    const now = "2026-10-15T12:00:00.000Z";
    const card = {
      ...exampleCardInput(),
      slug: "existing-acct",
      accountId,
    };
    const loadFile = { cards: [card], hostnames: [] };

    await withIsolatedLocalD1(async (db) => {
      await db
        .prepare(
          `INSERT INTO accounts (
            id, google_sub, email, name, status, created_at, updated_at, last_login_at
          ) VALUES (?, ?, ?, ?, 'active', ?, ?, NULL)`,
        )
        .bind(accountId, "fixture:manual", "owner@example.com", "Owner", now, now)
        .run();

      await assertAccountsExistForLoad(db, [accountId]);
      const sql = buildCardsLoadSql(loadFile, {
        updatedAt: now,
        newCardIds: newCardIdsForLoad(loadFile),
        accountIds: newAccountIdsForLoad(loadFile),
      });
      expect(sql).not.toMatch(/INSERT INTO accounts/i);

      for (const statement of splitSqlStatements(sql)) {
        await db.prepare(statement).run();
      }
      const row = await db
        .prepare(`SELECT account_id FROM cards WHERE slug = ?`)
        .bind("existing-acct")
        .first<{ account_id: string }>();
      expect(row?.account_id).toBe(accountId);
    });
  });

  it("matches D1CardRepository round-trip for example card shape", async () => {
    const card = { ...exampleCardInput(), slug: "sql-apostrophe" };
    const loadFile = { cards: [card], hostnames: [] };
    const updatedAt = "2026-10-11T12:00:00.000Z";
    const sql = buildCardsLoadSql(loadFile, {
      updatedAt,
      newCardIds: newCardIdsForLoad(loadFile),
      accountIds: newAccountIdsForLoad(loadFile),
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
