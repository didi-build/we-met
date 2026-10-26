import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = ".github/workflows/deploy-staging.yml";
const GOOGLE_SMOKE_STEP = "Smoke check Google OAuth client ids differ";
const DEPLOY_STEP = "Deploy Worker to staging";

describe("Deploy staging workflow structure (unit)", () => {
  const workflow = readFileSync(WORKFLOW_PATH, "utf8");

  it("is triggered by push to main with production paths-ignore and workflow_dispatch", () => {
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("paths-ignore:");
    expect(workflow).toContain('- "docs/**"');
    expect(workflow).toContain('- "**/*.md"');
    expect(workflow).toContain("workflow_dispatch");
  });

  it("uses staging environment, concurrency, and main-only guard", () => {
    expect(workflow).toMatch(/environment:\s*\n\s+name:\s+staging/);
    expect(workflow).toContain("url: https://we-met.didi.build");
    expect(workflow).toContain("group: deploy-staging");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toMatch(/if:\s*github\.ref == 'refs\/heads\/main'/);
    expect(workflow).toContain("permissions:");
    expect(workflow).toContain("contents: read");
  });

  it("deploys with wrangler.staging.ci.jsonc and staging credentials only", () => {
    expect(workflow).toContain("wrangler.staging.ci.jsonc");
    expect(workflow).toContain("secrets.CLOUDFLARE_API_TOKEN_STAGING");
    expect(workflow).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
    expect(workflow).not.toContain("CLOUDFLARE_API_TOKEN_PRODUCTION");
    expect(workflow).not.toContain("CLOUDFLARE_API_TOKEN_NONPROD");
    expect(workflow).not.toContain("BOOTSTRAP_TOKEN");
    expect(workflow).not.toContain("provision-resources.mjs");
  });

  it("sets staging build env and commit SHA for the banner", () => {
    expect(workflow).toContain("WE_MET_ENV: staging");
    expect(workflow).toContain("WE_MET_BASE_URL: https://we-met.didi.build");
    expect(workflow).toContain("WE_MET_COMMIT_SHA: ${{ github.sha }}");
  });

  it("does not deploy warmup or follow-up consumer Workers", () => {
    expect(workflow).not.toContain("workers/warmup");
    expect(workflow).not.toContain("we-met-followup-email-consumer");
    expect(workflow).not.toContain(
      "opennextjs-cloudflare deploy --config wrangler.ci.jsonc",
    );
  });

  it("runs Google OAuth client id smoke after staging deploy", () => {
    const deployIdx = workflow.indexOf(DEPLOY_STEP);
    const smokeIdx = workflow.indexOf(GOOGLE_SMOKE_STEP);
    expect(deployIdx).toBeGreaterThan(-1);
    expect(smokeIdx).toBeGreaterThan(deployIdx);
    expect(workflow).toContain("scripts/check-google-oauth-client-ids.mjs");
  });
});
