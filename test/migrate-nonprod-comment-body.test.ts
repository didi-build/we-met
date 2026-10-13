import { describe, expect, it } from "vitest";
import {
  buildMigrateNonprodCommentBody,
  hashMarker,
  MIGRATE_NONPROD_MARKER,
  parseAppliedMigrationHash,
} from "../scripts/migrate-nonprod/comment-body.mjs";
import { hashMigrationFiles } from "../scripts/migrate-nonprod/hash.mjs";

describe("migrate-nonprod comment body (unit)", () => {
  const hash = "a".repeat(64);

  it("includes marker and hash comment", () => {
    const body = buildMigrateNonprodCommentBody({
      state: "waiting",
      headSha: "abc123",
      migrationHash: hash,
      files: ["migrations/0002_x.sql"],
      runUrl: "https://example.com/run/1",
    });
    expect(body.startsWith(MIGRATE_NONPROD_MARKER)).toBe(true);
    expect(body).toContain(hashMarker(hash));
    expect(body).toContain("Waiting for approval");
    expect(body).toContain("migrations/0002_x.sql");
  });

  it("parseAppliedMigrationHash returns hash only for applied status", () => {
    const applied = buildMigrateNonprodCommentBody({
      state: "applied",
      headSha: "abc",
      migrationHash: hash,
      files: [],
      appliedAt: "2026-10-13T00:00:00.000Z",
    });
    expect(parseAppliedMigrationHash(applied)).toBe(hash);

    const waiting = buildMigrateNonprodCommentBody({
      state: "waiting",
      headSha: "abc",
      migrationHash: hash,
    });
    expect(parseAppliedMigrationHash(waiting)).toBeNull();
  });
});

describe("hashMigrationFiles (unit)", () => {
  it("is stable for path order", () => {
    const files = [
      {
        path: "migrations/0002.sql",
        content: "CREATE TABLE IF NOT EXISTS t (id TEXT);",
      },
      {
        path: "migrations/0001.sql",
        content: "CREATE TABLE IF NOT EXISTS u (id TEXT);",
      },
    ];
    const reversed = [...files].reverse();
    expect(hashMigrationFiles(files)).toBe(hashMigrationFiles(reversed));
  });
});
