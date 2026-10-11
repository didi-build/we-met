import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOWS_DIR = ".github/workflows";

describe("Deploy production workflow structure (unit)", () => {
  const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");

  it("deploy job uses GitHub production environment", () => {
    expect(workflow).toMatch(/^\s+environment:\s+production/m);
  });

  it("is triggered by push to main and workflow_dispatch", () => {
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("workflow_dispatch");
  });

  it("deploy job runs only on refs/heads/main", () => {
    expect(workflow).toMatch(/if:\s*github\.ref == 'refs\/heads\/main'/);
  });

  it("does not reference non-prod Cloudflare token or preview Turnstile variable", () => {
    expect(workflow).not.toContain("CLOUDFLARE_API_TOKEN_NONPROD");
    expect(workflow).not.toContain("WE_MET_TURNSTILE_SITE_KEY_NONPROD");
  });
});

describe("Other workflows production isolation (unit)", () => {
  const workflowPaths = readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith(".yml"))
    .filter((name) => name !== "deploy-production.yml" && name !== "preview.yml")
    .map((name) => join(WORKFLOWS_DIR, name));

  for (const path of workflowPaths) {
    it(`${path} does not reference production-only secrets or variables`, () => {
      const text = readFileSync(path, "utf8");
      expect(text).not.toContain("CLOUDFLARE_API_TOKEN_PRODUCTION");
      expect(text).not.toContain("WE_MET_D1_DATABASE_ID_PRODUCTION");
      expect(text).not.toContain("WE_MET_TURNSTILE_SITE_KEY_PRODUCTION");
    });
  }
});

describe("Preview workflow production isolation (unit)", () => {
  const preview = readFileSync(".github/workflows/preview.yml", "utf8");

  it("does not reference production-only GitHub variables", () => {
    expect(preview).not.toContain("WE_MET_D1_DATABASE_ID_PRODUCTION");
    expect(preview).not.toContain("WE_MET_TURNSTILE_SITE_KEY_PRODUCTION");
    expect(preview).not.toContain("CLOUDFLARE_API_TOKEN_PRODUCTION");
  });
});
