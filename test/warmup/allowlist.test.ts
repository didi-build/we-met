import { describe, expect, it } from "vitest";
import {
  assertSeedRecipient,
  isSeedRecipient,
} from "../../workers/warmup/lib/allowlist";

describe("warmup allowlist (unit)", () => {
  const seeds = ["seed-a@example.com", "seed-b@example.com"];

  it("accepts a seed recipient (case-insensitive)", () => {
    expect(isSeedRecipient("SEED-A@example.com", seeds)).toBe(true);
  });

  it("rejects a non-seed recipient", () => {
    const result = assertSeedRecipient("other@example.com", seeds);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_in_seeds");
      expect(result.redacted).not.toContain("other@");
    }
  });
});
