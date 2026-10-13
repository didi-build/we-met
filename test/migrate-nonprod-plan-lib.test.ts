import { describe, expect, it } from "vitest";
import {
  checkAppliedFileImmutability,
  findDisallowedMigrationFileChanges,
} from "../scripts/migrate-nonprod/plan-lib.mjs";
import { hashFileContent } from "../scripts/migrate-nonprod/hash.mjs";

describe("migrate-nonprod plan-lib (unit)", () => {
  it("findDisallowedMigrationFileChanges flags modified, renamed, removed", () => {
    const files = [
      { filename: "migrations/a.sql", status: "added" },
      { filename: "migrations/b.sql", status: "modified" },
      { filename: "migrations/c.sql", status: "renamed" },
      { filename: "migrations/d.sql", status: "removed" },
      { filename: "src/x.ts", status: "modified" },
    ];
    expect(findDisallowedMigrationFileChanges(files).map((f) => f.filename)).toEqual([
      "migrations/b.sql",
      "migrations/c.sql",
      "migrations/d.sql",
    ]);
  });

  it("checkAppliedFileImmutability fails when applied file content changes", () => {
    const content = "CREATE TABLE IF NOT EXISTS t (id TEXT);";
    const applied = {
      hash: "x",
      files: { "migrations/0001.sql": hashFileContent(content) },
    };
    expect(
      checkAppliedFileImmutability(applied, [{ path: "migrations/0001.sql", content }])
        .ok,
    ).toBe(true);
    const changed = checkAppliedFileImmutability(applied, [
      { path: "migrations/0001.sql", content: content + "\n" },
    ]);
    expect(changed.ok).toBe(false);
  });
});
