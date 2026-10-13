import { describe, expect, it } from "vitest";
import { validateApplyPrHead } from "../scripts/migrate-nonprod/apply-guard.mjs";

describe("validateApplyPrHead (unit)", () => {
  it("rejects closed PRs and stale head SHA", () => {
    expect(
      validateApplyPrHead({
        prState: "closed",
        prHeadSha: "a",
        manifestHeadSha: "a",
      }).ok,
    ).toBe(false);
    expect(
      validateApplyPrHead({
        prState: "open",
        prHeadSha: "b",
        manifestHeadSha: "a",
      }).ok,
    ).toBe(false);
    expect(
      validateApplyPrHead({
        prState: "open",
        prHeadSha: "a",
        manifestHeadSha: "a",
      }).ok,
    ).toBe(true);
  });
});
