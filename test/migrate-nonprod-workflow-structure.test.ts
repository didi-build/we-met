import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Migrate non-prod workflow structure (unit)", () => {
  const workflow = readFileSync(".github/workflows/migrate-nonprod.yml", "utf8");

  it("only triggers on pull_request_target (migrations path) and workflow_dispatch", () => {
    expect(workflow).toContain("pull_request_target:");
    expect(workflow).toContain("paths:");
    expect(workflow).toContain("migrations/**");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s+pull_request:/m);
    expect(workflow).not.toMatch(/^\s+push:/m);
  });

  it("does not check out the PR head ref", () => {
    expect(workflow).not.toContain("head.sha");
    expect(workflow).not.toContain("head.ref");
    expect(workflow).not.toMatch(/ref:\s*\$\{\{\s*github\.event\.pull_request\.head/);
  });

  it("guards same-repo PRs and skips Dependabot on pull_request_target", () => {
    expect(workflow).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
    expect(workflow).toContain("dependabot[bot]");
  });

  it("apply job uses migrate-nonprod environment and depends on plan", () => {
    expect(workflow).toMatch(/apply:[\s\S]*?needs:\s*plan/m);
    expect(workflow).toMatch(/apply:[\s\S]*?environment:\s*migrate-nonprod/m);
  });

  it("uses minimal permissions", () => {
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("pull-requests: write");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("id-token: write");
  });

  it("does not interpolate PR-controlled values into run scripts", () => {
    const runBlocks =
      workflow.match(/run:\s*\|[\s\S]*?(?=\n\s{6}\S|\n\s{4}\S|$)/g) ?? [];
    for (const block of runBlocks) {
      expect(block).not.toMatch(/\$\{\{\s*github\.event\.pull_request/);
      expect(block).not.toMatch(/\$\{\{\s*inputs\./);
    }
  });

  it("plans via migrate-nonprod/plan.ts without wrangler in plan job", () => {
    const planSection = workflow.match(/^  plan:[\s\S]*?(?=^  apply:)/m)?.[0] ?? "";
    expect(planSection).toContain("migrate-nonprod/plan.ts");
    expect(planSection).not.toContain("wrangler");
    expect(planSection).not.toContain("CLOUDFLARE_API_TOKEN_MIGRATE_NONPROD");
  });

  it("checks out base ref with persist-credentials disabled on both jobs", () => {
    const matches = workflow.match(/persist-credentials: false/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("apply job checks out main and provisions non-prod resources from main only", () => {
    const applySection = workflow.match(/^  apply:[\s\S]*$/m)?.[0] ?? "";
    expect(applySection).toContain("ref: main");
    expect(applySection).toContain("provision-resources.mjs");
    expect(applySection).toContain("--target nonprod");
  });

  it("apply uses allowlisted apply-migrations script", () => {
    expect(workflow).toContain("migrate-nonprod/apply.ts");
    expect(workflow).toContain("WE_MET_D1_DATABASE_ID_NONPROD");
    expect(workflow).toContain("CLOUDFLARE_API_TOKEN_MIGRATE_NONPROD");
    expect(workflow).not.toContain("WE_MET_D1_DATABASE_ID_PRODUCTION");
    expect(workflow).not.toContain("CLOUDFLARE_API_TOKEN_PRODUCTION");
  });

  it("does not pass non-prod D1 id through GitHub variables (log leak)", () => {
    expect(workflow).not.toContain("vars.WE_MET_D1_DATABASE_ID_NONPROD");
    expect(workflow).toContain("secrets.WE_MET_D1_DATABASE_ID_NONPROD");
  });
});
