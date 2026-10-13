import { describe, expect, it } from "vitest";
import {
  buildAppliedStateMarker,
  buildMigrateNonprodCommentBody,
  hashMarker,
  MIGRATE_NONPROD_MARKER,
  parseAppliedMigrationHash,
  parseAppliedStateMarker,
} from "../scripts/migrate-nonprod/comment-body.mjs";
import { hashMigrationFiles } from "../scripts/migrate-nonprod/hash.mjs";

describe("migrate-nonprod comment body (unit)", () => {
  const hash = "a".repeat(64);
  const fileHashes = { "migrations/0002_x.sql": "b".repeat(64) };

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

  it("applied marker survives skipped updates", () => {
    const appliedMarker = buildAppliedStateMarker({ hash, files: fileHashes });
    const applied = buildMigrateNonprodCommentBody({
      state: "applied",
      headSha: "abc",
      migrationHash: hash,
      files: ["migrations/0002_x.sql"],
      fileHashes,
      appliedAt: "2026-10-13T00:00:00.000Z",
    });
    expect(parseAppliedMigrationHash(applied)).toBe(hash);

    const skipped = buildMigrateNonprodCommentBody({
      state: "skipped",
      headSha: "abc",
      migrationHash: hash,
      preservedAppliedMarker: appliedMarker,
    });
    expect(parseAppliedMigrationHash(skipped)).toBe(hash);
    expect(skipped).not.toContain("**Status:** Applied");

    const skippedAgain = buildMigrateNonprodCommentBody({
      state: "skipped",
      headSha: "abc",
      migrationHash: hash,
      preservedAppliedMarker: appliedMarker,
    });
    expect(parseAppliedMigrationHash(skippedAgain)).toBe(hash);
  });

  it("changed hash after apply goes to waiting without losing applied marker record", () => {
    const appliedMarker = buildAppliedStateMarker({ hash, files: fileHashes });
    const newHash = "c".repeat(64);
    const waiting = buildMigrateNonprodCommentBody({
      state: "waiting",
      headSha: "def",
      migrationHash: newHash,
      preservedAppliedMarker: appliedMarker,
      files: ["migrations/0003_y.sql"],
    });
    expect(parseAppliedStateMarker(waiting)?.hash).toBe(hash);
    expect(waiting).toContain(newHash);
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
