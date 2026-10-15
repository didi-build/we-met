import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lintMigrationSql } from "@/migrations/expand-only-lint";

describe("0002_lead_delivery_ledger migration (unit)", () => {
  const sql = readFileSync("migrations/0002_lead_delivery_ledger.sql", "utf8");

  it("passes expand-only migration lint", () => {
    expect(lintMigrationSql(sql)).toEqual({ ok: true });
  });

  it("declares unique (lead_id, sink_id, phase)", () => {
    expect(sql).toMatch(/UNIQUE\s*\(\s*lead_id\s*,\s*sink_id\s*,\s*phase\s*\)/i);
  });

  it("declares phase and status checks", () => {
    expect(sql).toMatch(/phase.*record.*append/i);
    expect(sql).toMatch(/status.*queued.*sent.*failed/i);
  });
});
