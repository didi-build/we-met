import { describe, expect, it } from "vitest";
import {
  formatApplyFailureCommentError,
  formatApplyResultSummaryBlock,
} from "../scripts/migrate-nonprod/apply-output.mjs";

describe("migrate-nonprod apply output (unit)", () => {
  it("sanitizes failure comment text after redaction", () => {
    const raw = "failed ```sql\nDROP --> secret\n";
    const out = formatApplyFailureCommentError(raw);
    expect(out).not.toContain("```");
    expect(out).not.toContain("-->");
  });

  it("uses a fence longer than triple backticks in result summary", () => {
    const output = "line1\n```\nline2\n<!-- hide -->\n";
    const block = formatApplyResultSummaryBlock(output);
    expect(block.startsWith("### Result\n\n")).toBe(true);
    expect(block).toContain("````\n");
    expect(block).not.toMatch(/^### Result\n\n```\n/m);
    expect(block).toContain("<!-- hide -->");
  });
});
