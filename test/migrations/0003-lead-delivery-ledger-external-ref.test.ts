import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lintMigrationSql } from "@/migrations/expand-only-lint";

describe("0003_lead_delivery_ledger_external_ref migration (unit)", () => {
  const sql = readFileSync(
    "migrations/0003_lead_delivery_ledger_external_ref.sql",
    "utf8",
  );

  it("passes expand-only migration lint", () => {
    expect(lintMigrationSql(sql)).toEqual({ ok: true });
  });

  it("adds external_ref column to lead_delivery_ledger", () => {
    expect(sql).toMatch(
      /ALTER\s+TABLE\s+lead_delivery_ledger\s+ADD\s+COLUMN\s+external_ref/i,
    );
  });
});
