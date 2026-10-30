import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lintMigrationSql } from "@/migrations/expand-only-lint";
import { splitSqlStatements } from "@/card-data/sql-statements";
import { withEmptyIsolatedLocalD1, withIsolatedLocalD1 } from "../helpers/d1";

function migrationStatementsBefore0005(): string[] {
  const dir = resolve("migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql") && name < "0005_cards_rebuild_mvp.sql")
    .sort();
  const statements: string[] = [];
  for (const file of files) {
    const sql = readFileSync(resolve(dir, file), "utf8");
    statements.push(...splitSqlStatements(sql));
  }
  return statements;
}

describe("0005_cards_rebuild_mvp migration", () => {
  const sql = readFileSync("migrations/0005_cards_rebuild_mvp.sql", "utf8");

  it("does not pass expand-only migration lint", () => {
    expect(lintMigrationSql(sql).ok).toBe(false);
  });

  it("can be retried after CHECK failure when cards is emptied", async () => {
    await withEmptyIsolatedLocalD1(async (db) => {
      for (const statement of migrationStatementsBefore0005()) {
        await db.prepare(statement).run();
      }
      const now = "2026-10-15T12:00:00.000Z";
      await db
        .prepare(
          `INSERT INTO cards (
            id, slug, variant, display_name, email, photo_key,
            links_json, page_copy_json, contact_json, copy_json, updated_at
          ) VALUES (?, ?, 'mono', 'Name', 'owner@example.com', NULL, '{}', '{}', '{}', '{}', ?)`,
        )
        .bind("card-1", "demo", now)
        .run();

      const statements = splitSqlStatements(sql);
      let failed = false;
      try {
        for (const statement of statements) {
          await db.prepare(statement).run();
        }
      } catch (error) {
        failed = true;
        expect(String(error)).toMatch(/CHECK constraint failed/i);
      }
      expect(failed).toBe(true);

      await db.prepare(`DELETE FROM cards`).run();

      for (const statement of statements) {
        await db.prepare(statement).run();
      }
      const count = await db
        .prepare(`SELECT COUNT(*) AS n FROM cards`)
        .first<{ n: number }>();
      expect(count?.n).toBe(0);
    });
  });

  it("fails when cards already has a row", async () => {
    await withEmptyIsolatedLocalD1(async (db) => {
      for (const statement of migrationStatementsBefore0005()) {
        await db.prepare(statement).run();
      }
      const now = "2026-10-15T12:00:00.000Z";
      await db
        .prepare(
          `INSERT INTO cards (
            id, slug, variant, display_name, email, photo_key,
            links_json, page_copy_json, contact_json, copy_json, updated_at
          ) VALUES (?, ?, 'mono', 'Name', 'owner@example.com', NULL, '{}', '{}', '{}', '{}', ?)`,
        )
        .bind("card-1", "demo", now)
        .run();

      await expect(async () => {
        for (const statement of splitSqlStatements(sql)) {
          await db.prepare(statement).run();
        }
      }).rejects.toThrow(/CHECK constraint failed/i);
    });
  });

  it("succeeds when cards is empty", async () => {
    await withEmptyIsolatedLocalD1(async (db) => {
      for (const statement of migrationStatementsBefore0005()) {
        await db.prepare(statement).run();
      }
      for (const statement of splitSqlStatements(sql)) {
        await db.prepare(statement).run();
      }
      const count = await db
        .prepare(`SELECT COUNT(*) AS n FROM cards`)
        .first<{ n: number }>();
      expect(count?.n).toBe(0);
      const signups = await db
        .prepare(`SELECT value FROM app_settings WHERE key = 'signups_open'`)
        .first<{ value: string }>();
      expect(signups?.value).toBe("0");
    });
  });

  it("keeps hostnames and lead_sinks foreign keys pointing at cards after rebuild", async () => {
    await withIsolatedLocalD1(async (db) => {
      const hostFk = await db.prepare(`PRAGMA foreign_key_list(hostnames)`).all<{
        table: string;
      }>();
      const sinkFk = await db.prepare(`PRAGMA foreign_key_list(lead_sinks)`).all<{
        table: string;
      }>();
      expect(hostFk.results?.some((row) => row.table === "cards")).toBe(true);
      expect(sinkFk.results?.some((row) => row.table === "cards")).toBe(true);
    });
  });
});
