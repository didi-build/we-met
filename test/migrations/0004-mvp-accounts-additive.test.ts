import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lintMigrationSql } from "@/migrations/expand-only-lint";

describe("0004_mvp_accounts_additive migration (unit)", () => {
  const sql = readFileSync("migrations/0004_mvp_accounts_additive.sql", "utf8");

  it("passes expand-only migration lint", () => {
    expect(lintMigrationSql(sql)).toEqual({ ok: true });
  });

  it("creates accounts and app_settings tables", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS accounts/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS app_settings/i);
  });
});
