import { splitSqlStatements } from "@/card-data/sql-statements";

const FORBIDDEN_LEADING = /^(DROP|DELETE|UPDATE|RENAME|PRAGMA|ATTACH)\b/i;

const CREATE_TABLE_IF_NOT_EXISTS = /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+/i;
const CREATE_INDEX_IF_NOT_EXISTS = /^CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+/i;
const ALTER_TABLE_ADD_COLUMN =
  /^ALTER\s+TABLE\s+(?:"[^"]+"|'[^']+'|\[[^\]]+\]|`[^`]+`|\w+)\s+ADD\s+COLUMN\s+/i;

export function isAllowedMigrationStatement(statement: string): boolean {
  const trimmed = statement.trim();
  if (!trimmed) {
    return false;
  }
  if (FORBIDDEN_LEADING.test(trimmed)) {
    return false;
  }
  if (CREATE_TABLE_IF_NOT_EXISTS.test(trimmed)) {
    return true;
  }
  if (CREATE_INDEX_IF_NOT_EXISTS.test(trimmed)) {
    return true;
  }
  if (ALTER_TABLE_ADD_COLUMN.test(trimmed)) {
    return true;
  }
  if (/^ALTER\s+TABLE\b/i.test(trimmed)) {
    return false;
  }
  if (/^CREATE\s+TABLE\b/i.test(trimmed)) {
    return false;
  }
  if (/^CREATE\s+INDEX\b/i.test(trimmed)) {
    return false;
  }
  return false;
}

export type LintMigrationSqlResult =
  { ok: true } | { ok: false; message: string; statementIndex?: number };

/** Expand-only lint for shared non-prod D1 (see deploy runbook). */
export function lintMigrationSql(sql: string): LintMigrationSqlResult {
  const statements = splitSqlStatements(sql);
  if (statements.length === 0) {
    return { ok: false, message: "Migration file contains no SQL statements." };
  }
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!isAllowedMigrationStatement(statement)) {
      const preview = statement.replace(/\s+/g, " ").slice(0, 120);
      return {
        ok: false,
        message: `Statement ${i + 1} is not expand-only allowed SQL: ${preview}`,
        statementIndex: i + 1,
      };
    }
  }
  return { ok: true };
}
