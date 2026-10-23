import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Preview workflow structure (unit)", () => {
  const preview = readFileSync(".github/workflows/preview.yml", "utf8");

  it("both jobs use the preview GitHub environment; deploy job sets deployment url", () => {
    expect(preview).toMatch(/^\s+environment:\s*$/m);
    expect(preview).toContain("name: preview");
    expect(preview).toContain("url: ${{ steps.preview.outputs.preview_url }}");
    expect(preview).toMatch(/cleanup:[\s\S]*?environment:\s+preview/m);
  });

  it("does not skip preview or cleanup when a D1 variable is unset", () => {
    expect(preview).not.toContain("vars.WE_MET_D1_DATABASE_ID_NONPROD !=");
  });

  it("comment lookup trusts only github-actions[bot] comments with the preview marker", () => {
    expect(preview).toContain("github-actions[bot]");
    expect(preview).toMatch(/user\.login == \\"github-actions\[bot\]\\"/);
    expect(preview).toContain("we-met-preview");
  });

  it("comment lookup does not pipe gh api output through head", () => {
    expect(preview).not.toContain("head -n 1");
  });

  it("comment step detects migration files via pulls API and builds body with preview-comment-body.mjs", () => {
    expect(preview).toContain("pulls/${PR_NUMBER}/files");
    expect(preview).toContain("preview-comment-body.mjs");
  });

  it("does not run provision-resources (non-prod provision is main-branch only)", () => {
    expect(preview).not.toContain("provision-resources.mjs");
  });

  it("parses wrangler preview JSON via parse-wrangler-preview-json.mjs", () => {
    expect(preview).toContain("parse-wrangler-preview-json.mjs");
    expect(preview).not.toMatch(/\|\s*jq\b/);
  });
});
