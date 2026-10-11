import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Preview workflow structure (unit)", () => {
  const preview = readFileSync(".github/workflows/preview.yml", "utf8");

  it("comment lookup trusts only github-actions[bot] comments with the preview marker", () => {
    expect(preview).toContain("github-actions[bot]");
    expect(preview).toMatch(/user\.login == \\"github-actions\[bot\]\\"/);
    expect(preview).toContain("we-met-preview");
  });

  it("comment lookup does not pipe gh api output through head", () => {
    expect(preview).not.toContain("head -n 1");
  });
});
