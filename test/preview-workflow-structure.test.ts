import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseJsonc } from "../scripts/lib/parse-jsonc.mjs";

const PREVIEW_BUILD_STEP = "Build OpenNext (non-prod Turnstile site key)";

function previewRuntimeBaseUrl(): string {
  const config = parseJsonc(readFileSync("wrangler.jsonc", "utf8")) as {
    previews: { vars: { WE_MET_BASE_URL: string } };
  };
  return config.previews.vars.WE_MET_BASE_URL;
}

function extractPreviewBuildStepEnvBlock(workflow: string): string {
  const stepMatch = workflow.match(
    new RegExp(
      `- name: ${PREVIEW_BUILD_STEP.replace(/[()]/g, "\\$&")}[\\s\\S]*?(?=\\n      - name:|\\n  [a-z])`,
    ),
  );
  const block = stepMatch?.[0] ?? "";
  const envMatch = block.match(/^        env:\n([\s\S]*?)^        run:/m);
  return envMatch?.[1] ?? "";
}

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

  it("gates preview on non-prod resources declared vs main", () => {
    expect(preview).toContain("verify-preview-nonprod-resources.mjs");
    expect(preview).toContain("git fetch origin main");
  });

  it("parses wrangler preview JSON via parse-wrangler-preview-json.mjs", () => {
    expect(preview).toContain("parse-wrangler-preview-json.mjs");
    expect(preview).not.toMatch(/\|\s*jq\b/);
  });

  it("sets preview build-time WE_MET_BASE_URL to match previews.vars in wrangler.jsonc", () => {
    const runtimeBaseUrl = previewRuntimeBaseUrl();
    expect(runtimeBaseUrl).toBe("https://we-met.didi.build");
    const buildEnv = extractPreviewBuildStepEnvBlock(preview);
    expect(buildEnv).toContain(`WE_MET_BASE_URL: ${runtimeBaseUrl}`);
    expect(buildEnv).toContain("WE_MET_ENV: preview");
  });
});
