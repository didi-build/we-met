import { describe, expect, it } from "vitest";
import {
  decidePlanCommentState,
  validateMigrationFilename,
} from "../scripts/migrate-nonprod/plan-lib.mjs";

describe("decidePlanCommentState (table)", () => {
  const hashA = "a".repeat(64);
  const hashB = "b".repeat(64);

  const cases: {
    name: string;
    input: Parameters<typeof decidePlanCommentState>[0];
    expected: ReturnType<typeof decidePlanCommentState>["kind"];
  }[] = [
    {
      name: "applied then skipped (same hash)",
      input: {
        appliedHash: hashA,
        migrationHash: hashA,
        immutability: { ok: true },
      },
      expected: "skipped",
    },
    {
      name: "applied then skipped again",
      input: {
        appliedHash: hashA,
        migrationHash: hashA,
        immutability: { ok: true },
      },
      expected: "skipped",
    },
    {
      name: "applied then changed hash goes to waiting",
      input: {
        appliedHash: hashA,
        migrationHash: hashB,
        immutability: { ok: true },
      },
      expected: "waiting",
    },
    {
      name: "applied file content changed fails",
      input: {
        appliedHash: hashA,
        migrationHash: hashB,
        immutability: {
          ok: false,
          message:
            "Applied migration file content changed (immutable): migrations/x.sql",
        },
      },
      expected: "failed",
    },
    {
      name: "no prior apply waits",
      input: {
        appliedHash: null,
        migrationHash: hashA,
        immutability: { ok: true },
      },
      expected: "waiting",
    },
  ];

  for (const { name, input, expected } of cases) {
    it(name, () => {
      expect(decidePlanCommentState(input).kind).toBe(expected);
    });
  }
});

describe("validateMigrationFilename (unit)", () => {
  it("accepts safe migration paths", () => {
    expect(validateMigrationFilename("migrations/0002_add.sql").ok).toBe(true);
  });

  it("rejects adversarial names", () => {
    for (const name of [
      "migrations/-->.sql",
      "migrations/`x`.sql",
      "migrations/a\nb.sql",
      "migrations/../evil.sql",
    ]) {
      expect(validateMigrationFilename(name).ok).toBe(false);
    }
  });
});
