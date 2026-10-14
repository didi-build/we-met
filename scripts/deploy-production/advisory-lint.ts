import { lintMigrationSql } from "../../src/migrations/expand-only-lint";

/**
 * Advisory expand-only lint for production plan output (never blocks deploy).
 */
export function collectAdvisoryLintWarnings(path: string, sql: string): string[] {
  const result = lintMigrationSql(sql);
  if (result.ok) {
    return [];
  }
  return [`${path}: ${result.message}`];
}
