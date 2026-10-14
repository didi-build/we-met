import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOWS_DIR = ".github/workflows";

function extractPlanJobSection(workflow: string): string {
  return workflow.match(/^  plan:[\s\S]*?(?=^  deploy:)/m)?.[0] ?? "";
}

type PlanStepBlock = { id?: string; name?: string; block: string };

function splitPlanJobSteps(planSection: string): PlanStepBlock[] {
  const stepsMarker = "    steps:\n";
  const stepsIdx = planSection.indexOf(stepsMarker);
  if (stepsIdx === -1) {
    return [];
  }
  const afterSteps = planSection.slice(stepsIdx + stepsMarker.length);
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of afterSteps.split("\n")) {
    if (/^      - /.test(line)) {
      if (current.length > 0) {
        blocks.push(current.join("\n"));
      }
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) {
    blocks.push(current.join("\n"));
  }
  return blocks.map((block) => {
    const id = block.match(/^      - id: (\S+)/)?.[1];
    const name = block.match(/^      - name: (.+)/)?.[1]?.trim();
    return { id, name, block };
  });
}

function planStepById(steps: PlanStepBlock[], id: string): PlanStepBlock {
  const step = steps.find((s) => s.id === id);
  if (!step) {
    throw new Error(`plan job step id ${id} not found`);
  }
  return step;
}

function planStepByName(steps: PlanStepBlock[], name: string): PlanStepBlock {
  const step = steps.find((s) => s.name === name);
  if (!step) {
    throw new Error(`plan job step name ${name} not found`);
  }
  return step;
}

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
    const planSection = extractPlanJobSection(workflow);
    expect(planSection).not.toMatch(/^\s+environment:/m);
    expect(planSection).not.toContain("secrets.");
    expect(planSection).toContain("contents: read");
    expect(planSection).toContain("deployments: read");
    expect(planSection).not.toContain("contents: write");
    expect(planSection).not.toContain("id-token: write");
  });

  it("deploy job needs plan and keeps the original app deploy steps unchanged as a prefix", () => {
    const deploySection = workflow.match(/^  deploy:[\s\S]*$/m)?.[0] ?? "";
    expect(deploySection).toMatch(/needs:\s*plan/);
    expect(deploySection).toContain(EXPECTED_DEPLOY_STEPS_BLOCK);
  });

  it("deploy job appends production follow-up email consumer steps after the app deploy", () => {
    const deploySection = workflow.match(/^  deploy:[\s\S]*$/m)?.[0] ?? "";
    expect(deploySection).toContain("Prepare follow-up email consumer Wrangler config");
    expect(deploySection).toContain("--target consumer-production");
    expect(deploySection).toContain("wrangler.production.ci.jsonc");
    expect(deploySection).toContain("Deploy-time guards (production consumer)");
    expect(deploySection).toContain("Deploy follow-up email consumer to production");
    expect(deploySection).toContain("CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION");
    expect(deploySection).not.toContain("WE_MET_TEST_MAIL_TO");
    const appDeployIdx = deploySection.indexOf("opennextjs-cloudflare deploy");
    const consumerPrepareIdx = deploySection.indexOf(
      "Prepare follow-up email consumer",
    );
    expect(appDeployIdx).toBeGreaterThan(-1);
    expect(consumerPrepareIdx).toBeGreaterThan(appDeployIdx);
  });

  it("plan job uses only pinned actions/* SHAs", () => {
    const planSection = extractPlanJobSection(workflow);
    const usesLines = planSection.match(/uses:\s+[^\n]+/g) ?? [];
    expect(usesLines.length).toBeGreaterThan(0);
    for (const line of usesLines) {
      expect(line).toMatch(/uses:\s+actions\/[^@\s]+@[0-9a-f]{40}/);
    }
    expect(planSection).not.toMatch(/uses:\s+(?!actions\/)/);
  });

  it("plan job does not interpolate user-derived values into run scripts", () => {
    const planSection = extractPlanJobSection(workflow);
    const runBlocks = planSection.match(/run:\s*[^\n]+/g) ?? [];
    for (const block of runBlocks) {
      expect(block).not.toMatch(/\$\{\{\s*github\.event\./);
    }
  });

  it("plan job runs deploy-production plan script", () => {
    const planSection = extractPlanJobSection(workflow);
    expect(planSection).toContain("deploy-production/plan.ts");
    expect(planSection).not.toContain("CLOUDFLARE_API_TOKEN_PRODUCTION");
    expect(planSection).not.toContain("wrangler");
  });

  it("plan job passes GH_TOKEN from github.token on the plan step", () => {
    const planSection = extractPlanJobSection(workflow);
    expect(planSection).toContain("GH_TOKEN: ${{ github.token }}");
    expect(planSection).not.toContain("secrets.GITHUB_TOKEN");
  });

  it("plan job steps use continue-on-error, timeouts, and setup failure reporter", () => {
    const planSection = extractPlanJobSection(workflow);
    const steps = splitPlanJobSteps(planSection);

    const checkout = planStepById(steps, "checkout");
    expect(checkout.block).toContain("continue-on-error: true");
    expect(checkout.block).toContain("timeout-minutes: 2");

    const setupNode = planStepById(steps, "setup-node");
    expect(setupNode.block).toContain("continue-on-error: true");
    expect(setupNode.block).toContain("timeout-minutes: 2");

    const npmCi = planStepById(steps, "npm-ci");
    expect(npmCi.block).toContain("continue-on-error: true");
    expect(npmCi.block).toContain("timeout-minutes: 5");

    const planScript = planStepById(steps, "plan-script");
    expect(planScript.block).toContain("continue-on-error: true");
    expect(planScript.block).toContain("timeout-minutes: 5");

    const fallback = planStepByName(steps, "Plan checkout fallback notice");
    expect(fallback.block).toContain("continue-on-error: true");
    expect(fallback.block).toContain("steps.checkout.outcome == 'failure'");
    expect(fallback.block).toContain(
      "PLAN FAILED: checkout failed before the plan could run",
    );
    const fallbackRun = fallback.block.match(/run: \|([\s\S]*)/)?.[1] ?? "";
    expect(fallbackRun).not.toContain("${{");

    const reporter = planStepByName(steps, "Report plan job setup failure");
    expect(reporter.block).toContain("continue-on-error: true");
    expect(reporter.block).toContain("report-setup-failure.mjs");
    expect(reporter.block).toContain("CHECKOUT_OUTCOME: ${{ steps.checkout.outcome }}");
    expect(reporter.block).toContain(
      "PLAN_STEP_OUTCOME: ${{ steps.plan-script.outcome }}",
    );
    expect(reporter.block).toContain("steps.plan-script.outcome == 'failure'");

    expect(planSection).toContain("steps.npm-ci.outcome == 'success'");
  });

  it("does not reference non-prod Cloudflare token, D1 variable, or preview Turnstile variable", () => {
    expect(workflow).not.toContain("CLOUDFLARE_API_TOKEN_NONPROD");
    expect(workflow).not.toContain("WE_MET_D1_DATABASE_ID_NONPROD");
    expect(workflow).not.toContain("WE_MET_TURNSTILE_SITE_KEY_NONPROD");
  });

  it("uses the consumer production token only for the consumer wrangler deploy step", () => {
    const deploySection = workflow.match(/^  deploy:[\s\S]*$/m)?.[0] ?? "";
    const matches =
      deploySection.match(/CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION/g) ?? [];
    expect(matches.length).toBe(1);
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
