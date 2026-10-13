import { describe, expect, it } from "vitest";
import {
  isAllowedMigrationStatement,
  lintMigrationSql,
  splitMigrationSqlForLint,
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
    "INSERT INTO cards VALUES ('x')",
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

  it("does not split on semicolons inside block comments", () => {
    const sql =
      "CREATE TABLE IF NOT EXISTS t (id TEXT); /* DROP TABLE x; */ CREATE TABLE IF NOT EXISTS u (id TEXT);";
    expect(lintMigrationSql(sql)).toEqual({ ok: true });
  });

  it("rejects backslash-quote string bypass (SQLite closes string at quote)", () => {
    const sql =
      "CREATE TABLE IF NOT EXISTS t (n TEXT DEFAULT '\\'); DROP TABLE cards; CREATE TABLE IF NOT EXISTS u (n TEXT DEFAULT '\\'); -- '";
    expect(lintMigrationSql(sql).ok).toBe(false);
    const statements = splitMigrationSqlForLint(sql);
    expect(statements.some((s) => /^DROP\b/i.test(s.trim()))).toBe(true);
  });

  it("allows a string literal containing a backslash", () => {
    const sql = "CREATE TABLE IF NOT EXISTS t (note TEXT DEFAULT 'path\\to\\file');";
    expect(lintMigrationSql(sql)).toEqual({ ok: true });
  });

  it("handles doubled single quotes inside strings", () => {
    const sql = "CREATE TABLE IF NOT EXISTS t (note TEXT DEFAULT 'it''s ok');";
    expect(lintMigrationSql(sql)).toEqual({ ok: true });
  });

  it("does not split on semicolons inside double-quoted identifiers", () => {
    const sql = 'CREATE TABLE IF NOT EXISTS "a;b" (id TEXT);';
    expect(lintMigrationSql(sql)).toEqual({ ok: true });
    expect(splitMigrationSqlForLint(sql)).toHaveLength(1);
  });

  it("rejects double-quoted identifier bypass hiding DROP", () => {
    const sql = "CREATE TABLE IF NOT EXISTS \"a'b\" (id TEXT); DROP TABLE cards; -- '";
    expect(lintMigrationSql(sql).ok).toBe(false);
  });

  it("rejects backtick identifier bypass hiding DROP", () => {
    const sql = "CREATE TABLE IF NOT EXISTS `a'b` (id TEXT); DROP TABLE cards; -- '";
    expect(lintMigrationSql(sql).ok).toBe(false);
  });

  it("rejects bracket identifier bypass hiding DROP", () => {
    const sql = "CREATE TABLE IF NOT EXISTS [a'b] (id TEXT); DROP TABLE cards; -- '";
    expect(lintMigrationSql(sql).ok).toBe(false);
  });

  it("rejects unterminated string literals", () => {
    const result = lintMigrationSql(
      "CREATE TABLE IF NOT EXISTS t (note TEXT DEFAULT 'oops",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Unterminated single-quoted string");
    }
  });

  it("does not treat semicolons inside block comments as statement boundaries", () => {
    const sql =
      "CREATE TABLE IF NOT EXISTS t (id TEXT); /* ; DROP TABLE secret; */ SELECT 1;";
    const result = lintMigrationSql(sql);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Statement 2");
    }
  });
});

describe("lintMigrationSql quoting bypass property (table)", () => {
  const expandOnlyStatements = [
    "CREATE TABLE IF NOT EXISTS t (id TEXT PRIMARY KEY)",
    "CREATE INDEX IF NOT EXISTS idx ON t (id)",
    "ALTER TABLE cards ADD COLUMN extra TEXT",
  ];

  const forbiddenStatements = [
    "DROP TABLE cards",
    "DELETE FROM cards",
    "UPDATE cards SET x = 1",
    "INSERT INTO cards VALUES ('x')",
    "PRAGMA foreign_keys = ON",
    "ATTACH DATABASE 'x' AS y",
  ];

  type WrapStyle = { id: string; wrap: (forbidden: string) => string };

  const wrapStyles: WrapStyle[] = [
    {
      id: "single-quoted tail",
      wrap: (forbidden) =>
        `CREATE TABLE IF NOT EXISTS t (n TEXT DEFAULT 'x'); ${forbidden}; -- '`,
    },
    {
      id: "double-quoted identifier",
      wrap: (forbidden) =>
        `CREATE TABLE IF NOT EXISTS "a'b" (id TEXT); ${forbidden}; -- '`,
    },
    {
      id: "backtick identifier",
      wrap: (forbidden) =>
        `CREATE TABLE IF NOT EXISTS \`a'b\` (id TEXT); ${forbidden}; -- '`,
    },
    {
      id: "bracket identifier",
      wrap: (forbidden) =>
        `CREATE TABLE IF NOT EXISTS [a'b] (id TEXT); ${forbidden}; -- '`,
    },
  ];

  for (const expand of expandOnlyStatements) {
    for (const forbidden of forbiddenStatements) {
      for (const { id, wrap } of wrapStyles) {
        it(`rejects ${forbidden} after expand-only via ${id}`, () => {
          const sql = `${expand}; ${wrap(forbidden)}`;
          expect(lintMigrationSql(sql).ok).toBe(false);
        });
      }
    }
  }
});
