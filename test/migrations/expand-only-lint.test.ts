import { describe, expect, it } from "vitest";
import {
  isAllowedMigrationStatement,
  lintMigrationSql,
} from "@/migrations/expand-only-lint";

describe("isAllowedMigrationStatement (unit)", () => {
  const allowed = [
    "CREATE TABLE IF NOT EXISTS t (id TEXT PRIMARY KEY)",
    "create table if not exists t (id text)",
    "CREATE INDEX IF NOT EXISTS idx ON t (id)",
    "ALTER TABLE cards ADD COLUMN extra TEXT",
    'ALTER TABLE "cards" ADD COLUMN extra TEXT',
    "ALTER TABLE `cards` ADD COLUMN extra TEXT",
  ];

  for (const sql of allowed) {
    it(`allows: ${sql.slice(0, 60)}`, () => {
      expect(isAllowedMigrationStatement(sql)).toBe(true);
    });
  }

  const rejected = [
    "DROP TABLE cards",
    "DELETE FROM cards",
    "UPDATE cards SET x = 1",
    "RENAME TABLE a TO b",
    "PRAGMA foreign_keys = ON",
    "ATTACH DATABASE 'x' AS y",
    "CREATE TABLE t (id TEXT)",
    "CREATE INDEX idx ON t (id)",
    "ALTER TABLE cards DROP COLUMN extra",
    "ALTER TABLE cards RENAME COLUMN a TO b",
    "SELECT 1",
  ];

  for (const sql of rejected) {
    it(`rejects: ${sql}`, () => {
      expect(isAllowedMigrationStatement(sql)).toBe(false);
    });
  }
});

describe("lintMigrationSql (unit)", () => {
  it("allows multiple expand-only statements", () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS t (id TEXT);
      CREATE INDEX IF NOT EXISTS idx ON t (id);
      ALTER TABLE t ADD COLUMN note TEXT;
    `;
    expect(lintMigrationSql(sql)).toEqual({ ok: true });
  });

  it("does not split on semicolons inside string literals", () => {
    const sql = "CREATE TABLE IF NOT EXISTS t (note TEXT DEFAULT 'a;b'); SELECT 1;";
    const result = lintMigrationSql(sql);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Statement 2");
    }
  });

  it("ignores -- line comments when splitting", () => {
    const sql = "CREATE TABLE IF NOT EXISTS t (id TEXT); -- DROP TABLE x;\nSELECT 1;";
    const result = lintMigrationSql(sql);
    expect(result.ok).toBe(false);
  });

  it("rejects empty files", () => {
    expect(lintMigrationSql("  \n  -- only comments\n")).toEqual({
      ok: false,
      message: "Migration file contains no SQL statements.",
    });
  });
});
