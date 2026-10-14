import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOWS_DIR = ".github/workflows";

/** Deploy job steps as of DIDI-595 (must stay unchanged aside from `needs: plan`). */
const EXPECTED_DEPLOY_STEPS_BLOCK = `    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - name: Prepare Wrangler config (production D1 IDs)
        env:
          WE_MET_D1_DATABASE_ID_PRODUCTION: \${{ vars.WE_MET_D1_DATABASE_ID_PRODUCTION }}
        run: |
          set -euo pipefail
          node scripts/prepare-wrangler-config.mjs \\
            --target production \\
            --output wrangler.ci.jsonc
      - name: Deploy-time guards (production)
        run: node scripts/check-deploy-guards.mjs --target production --config wrangler.ci.jsonc
      - name: Require production Turnstile site key
        env:
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: \${{ vars.WE_MET_TURNSTILE_SITE_KEY_PRODUCTION }}
        run: |
          set -euo pipefail
          if [ -z "\${NEXT_PUBLIC_TURNSTILE_SITE_KEY}" ]; then
            echo "::error::NEXT_PUBLIC_TURNSTILE_SITE_KEY (WE_MET_TURNSTILE_SITE_KEY_PRODUCTION) is empty"
            exit 1
          fi
      - name: Build OpenNext (production Turnstile site key)
        env:
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: \${{ vars.WE_MET_TURNSTILE_SITE_KEY_PRODUCTION }}
        run: npm run build
      - name: Apply production D1 migrations
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN_PRODUCTION }}
          CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          set -euo pipefail
          npx wrangler d1 migrations apply WE_MET_DB --remote \\
            --config wrangler.ci.jsonc
      - name: Deploy Worker to production
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN_PRODUCTION }}
          CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          npx opennextjs-cloudflare deploy --config wrangler.ci.jsonc`;

describe("Deploy production workflow structure (unit)", () => {
  const workflow = readFileSync(".github/workflows/deploy-production.yml", "utf8");

  it("deploy job uses GitHub production environment", () => {
    const deploySection = workflow.match(/^  deploy:[\s\S]*$/m)?.[0] ?? "";
    expect(deploySection).toMatch(/environment:\s+production/);
  });

  it("is triggered by push to main and workflow_dispatch", () => {
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("workflow_dispatch");
  });

  it("plan and deploy jobs run only on refs/heads/main", () => {
    expect(workflow).toMatch(/if:\s*github\.ref == 'refs\/heads\/main'/g);
    const matches = workflow.match(/if:\s*github\.ref == 'refs\/heads\/main'/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("plan job has no environment, no secrets, and minimal permissions", () => {
    const planSection = workflow.match(/^  plan:[\s\S]*?(?=^  deploy:)/m)?.[0] ?? "";
    expect(planSection).not.toMatch(/^\s+environment:/m);
    expect(planSection).not.toContain("secrets.");
    expect(planSection).toContain("contents: read");
    expect(planSection).toContain("deployments: read");
    expect(planSection).not.toContain("contents: write");
    expect(planSection).not.toContain("id-token: write");
  });

  it("deploy job needs plan and keeps steps, environment, and secrets unchanged", () => {
    const deploySection = workflow.match(/^  deploy:[\s\S]*$/m)?.[0] ?? "";
    expect(deploySection).toMatch(/needs:\s*plan/);
    expect(deploySection).toContain(EXPECTED_DEPLOY_STEPS_BLOCK);
  });

  it("plan job uses only pinned actions/* SHAs", () => {
    const planSection = workflow.match(/^  plan:[\s\S]*?(?=^  deploy:)/m)?.[0] ?? "";
    const usesLines = planSection.match(/uses:\s+[^\n]+/g) ?? [];
    expect(usesLines.length).toBeGreaterThan(0);
    for (const line of usesLines) {
      expect(line).toMatch(/uses:\s+actions\/[^@\s]+@[0-9a-f]{40}/);
    }
    expect(planSection).not.toMatch(/uses:\s+(?!actions\/)/);
  });

  it("plan job does not interpolate user-derived values into run scripts", () => {
    const planSection = workflow.match(/^  plan:[\s\S]*?(?=^  deploy:)/m)?.[0] ?? "";
    const runBlocks = planSection.match(/run:\s*[^\n]+/g) ?? [];
    for (const block of runBlocks) {
      expect(block).not.toMatch(/\$\{\{\s*github\.event\./);
    }
  });

  it("plan job runs deploy-production plan script", () => {
    const planSection = workflow.match(/^  plan:[\s\S]*?(?=^  deploy:)/m)?.[0] ?? "";
    expect(planSection).toContain("deploy-production/plan.ts");
    expect(planSection).not.toContain("CLOUDFLARE_API_TOKEN_PRODUCTION");
    expect(planSection).not.toContain("wrangler");
  });

  it("plan job passes GH_TOKEN from github.token on the plan step", () => {
    const planSection = workflow.match(/^  plan:[\s\S]*?(?=^  deploy:)/m)?.[0] ?? "";
    expect(planSection).toContain("GH_TOKEN: ${{ github.token }}");
    expect(planSection).not.toContain("secrets.GITHUB_TOKEN");
  });

  it("handles setup failures with continue-on-error and a setup failure reporter", () => {
    const planSection = workflow.match(/^  plan:[\s\S]*?(?=^  deploy:)/m)?.[0] ?? "";
    expect(planSection).toContain("id: checkout");
    expect(planSection).toContain("id: setup-node");
    expect(planSection).toContain("id: npm-ci");
    expect(planSection).toContain("continue-on-error: true");
    expect(planSection).toContain("steps.npm-ci.outcome == 'success'");
    expect(planSection).toContain("report-setup-failure.mjs");
    expect(planSection).toContain("CHECKOUT_OUTCOME: ${{ steps.checkout.outcome }}");
  });

  it("does not reference non-prod Cloudflare token, D1 variable, or preview Turnstile variable", () => {
    expect(workflow).not.toContain("CLOUDFLARE_API_TOKEN_NONPROD");
    expect(workflow).not.toContain("WE_MET_D1_DATABASE_ID_NONPROD");
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
