import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lintMigrationSql } from "@/migrations/expand-only-lint";

describe("0006 photo_upload_log migration (unit)", () => {
  it("passes expand-only lint", () => {
    const sql = readFileSync(
      join(process.cwd(), "migrations/0006_photo_upload_log.sql"),
      "utf8",
    );
    expect(lintMigrationSql(sql)).toEqual({ ok: true });
  });
});
