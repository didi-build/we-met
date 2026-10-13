import { describe, expect, it } from "vitest";
import {
  resolveApplyHeadCheck,
  validateApplyPrHead,
} from "../scripts/migrate-nonprod/apply-guard.mjs";

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

  it("resolveApplyHeadCheck does not update PR comment when head is stale", () => {
    const headCheck = validateApplyPrHead({
      prState: "open",
      prHeadSha: "b",
      manifestHeadSha: "a",
    });
    expect(resolveApplyHeadCheck(headCheck)).toEqual({
      proceed: false,
      updatePrComment: false,
      reason: headCheck.ok ? "" : headCheck.reason,
      exitCode: 1,
    });
  });
});
