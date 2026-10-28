import { describe, expect, it } from "vitest";
import {
  findRemoteOnlyAppliedMigrations,
  formatAppliedMigrationNamesForLog,
  formatMigrationDriftMarkdown,
  parseAppliedMigrationNamesFromWranglerExecute,
  redactD1UuidsInText,
} from "../scripts/lib/staging-d1-migration-drift.mjs";

describe("staging D1 migration drift (unit)", () => {
  it("parses applied migration names from wrangler execute JSON", () => {
    const json = [
      {
        results: [{ name: "0001_init.sql" }, { name: "0002_cards.sql" }],
      },
    ];
    expect(parseAppliedMigrationNamesFromWranglerExecute(json)).toEqual([
      "0001_init.sql",
      "0002_cards.sql",
    ]);
  });

  it("finds remote-only applied migrations", () => {
    const repo = new Set(["0001_init.sql"]);
    expect(
      findRemoteOnlyAppliedMigrations(["0001_init.sql", "9999_pr_only.sql"], repo),
    ).toEqual(["9999_pr_only.sql"]);
  });

  it("formats applied migration names for CI logs without database ids", () => {
    const text = formatAppliedMigrationNamesForLog(["0001_init.sql"]);
    expect(text).toContain("0001_init.sql");
    expect(text).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  it("formats warn-only markdown for drift", () => {
    const text = formatMigrationDriftMarkdown(["9999_pr_only.sql"]);
    expect(text).toContain("Warning");
    expect(text).toContain("9999_pr_only.sql");
  });

  it("redacts D1 UUIDs from drift stderr text", () => {
    const sample = "database abcdef12-3456-7890-abcd-ef1234567890 failed with error";
    expect(redactD1UuidsInText(sample)).toBe(
      "database <redacted-d1-id> failed with error",
    );
  });
});
