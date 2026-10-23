import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findVarsD1DatabaseIdReference } from "../scripts/check-workflow-d1-id-secrets.mjs";

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

type DeployStepBlock = { name: string | null; block: string };

function extractDeployJobSection(workflow: string): string {
  return workflow.match(/^  deploy:[\s\S]*$/m)?.[0] ?? "";
}

/** Split deploy job YAML steps (named steps and uses/run-only steps). */
function splitDeployJobSteps(deploySection: string): DeployStepBlock[] {
  const stepsMarker = "    steps:\n";
  const stepsIdx = deploySection.indexOf(stepsMarker);
  if (stepsIdx === -1) {
    return [];
  }
  const afterSteps = deploySection.slice(stepsIdx + stepsMarker.length);
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
    const name = block.match(/^      - name: (.+)/)?.[1]?.trim() ?? null;
    return { name, block };
  });
}

function deployStepByName(steps: DeployStepBlock[], name: string): DeployStepBlock {
  const step = steps.find((s) => s.name === name);
  if (!step) {
    throw new Error(`deploy job step named "${name}" not found`);
  }
  return step;
}

const CONSUMER_DEPLOY_STEP_NAME = "Deploy follow-up email consumer to production";
const WARMUP_DEPLOY_STEP_NAME = "Deploy warmup cron Worker to production";
const CONSUMER_PREPARE_STEP_NAME =
  "Prepare follow-up email consumer Wrangler config (production D1 ID)";
const CONSUMER_GUARDS_STEP_NAME = "Deploy-time guards (production consumer)";
const WARMUP_GUARDS_STEP_NAME = "Deploy-time guards (production warmup)";
const MIGRATIONS_STEP_NAME = "Apply production D1 migrations";
const APP_DEPLOY_STEP_NAME = "Deploy Worker to production";

const CONSUMER_PREPARE_ALLOWED_SECRET = "SECRETS.WE_MET_D1_DATABASE_ID_PRODUCTION";

/**
 * Consumer prepare may only reference the production D1 id secret (dot syntax).
 * @throws if bracket secrets, toJSON(secrets), or other secret names appear.
 */
export function assertConsumerPrepareSecretIsolation(
  block: string,
  stepName: string,
): void {
  if (/secrets\s*\[/i.test(block)) {
    throw new Error(`${stepName} must not use secrets[...] bracket syntax`);
  }
  if (/toJSON\s*\(\s*secrets/i.test(block)) {
    throw new Error(`${stepName} must not use toJSON(secrets...)`);
  }
  const secretRefs = block.match(/secrets\s*\.\s*[A-Za-z0-9_]+/gi) ?? [];
  for (const ref of secretRefs) {
    const normalized = ref.replace(/\s+/g, "").toUpperCase();
    if (normalized !== CONSUMER_PREPARE_ALLOWED_SECRET) {
      throw new Error(
        `${stepName} must only reference secrets.WE_MET_D1_DATABASE_ID_PRODUCTION (found ${ref})`,
      );
    }
  }
  if (!block.includes("secrets.WE_MET_D1_DATABASE_ID_PRODUCTION")) {
    throw new Error(`${stepName} must use secrets.WE_MET_D1_DATABASE_ID_PRODUCTION`);
  }
  if (findVarsD1DatabaseIdReference(block)) {
    throw new Error(`${stepName} must not use vars for production D1 id (log leak)`);
  }
}

/**
 * Asserts Cloudflare token secrets are wired to the correct deploy job steps.
 * @throws if any assertion fails (Vitest expect errors).
 */
function assertDeployJobCloudflareTokenIsolation(deploySection: string): void {
  const steps = splitDeployJobSteps(deploySection);
  if (steps.length === 0) {
    throw new Error("deploy job has no parseable steps");
  }

  const consumerDeploy = deployStepByName(steps, CONSUMER_DEPLOY_STEP_NAME);
  if (
    !consumerDeploy.block.includes(
      "CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION }}",
    )
  ) {
    throw new Error(
      `${CONSUMER_DEPLOY_STEP_NAME} must set CLOUDFLARE_API_TOKEN to CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION`,
    );
  }
  if (consumerDeploy.block.includes("CLOUDFLARE_API_TOKEN_PRODUCTION")) {
    throw new Error(
      `${CONSUMER_DEPLOY_STEP_NAME} must not reference CLOUDFLARE_API_TOKEN_PRODUCTION`,
    );
  }

  for (const step of steps) {
    if (step.name === CONSUMER_DEPLOY_STEP_NAME) continue;
    if (step.block.includes("CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION")) {
      throw new Error(
        `step "${step.name ?? "(unnamed)"}" must not reference CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION`,
      );
    }
  }

  const migrations = deployStepByName(steps, MIGRATIONS_STEP_NAME);
  const appDeploy = deployStepByName(steps, APP_DEPLOY_STEP_NAME);
  if (!migrations.block.includes("CLOUDFLARE_API_TOKEN_PRODUCTION")) {
    throw new Error(`${MIGRATIONS_STEP_NAME} must use CLOUDFLARE_API_TOKEN_PRODUCTION`);
  }
  if (migrations.block.includes("CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION")) {
    throw new Error(`${MIGRATIONS_STEP_NAME} must not use the consumer token`);
  }
  if (!appDeploy.block.includes("CLOUDFLARE_API_TOKEN_PRODUCTION")) {
    throw new Error(`${APP_DEPLOY_STEP_NAME} must use CLOUDFLARE_API_TOKEN_PRODUCTION`);
  }
  if (appDeploy.block.includes("CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION")) {
    throw new Error(`${APP_DEPLOY_STEP_NAME} must not use the consumer token`);
  }

  const warmupDeploy = deployStepByName(steps, WARMUP_DEPLOY_STEP_NAME);
  if (!warmupDeploy.block.includes("CLOUDFLARE_API_TOKEN_PRODUCTION")) {
    throw new Error(
      `${WARMUP_DEPLOY_STEP_NAME} must use CLOUDFLARE_API_TOKEN_PRODUCTION`,
    );
  }
  if (warmupDeploy.block.includes("CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION")) {
    throw new Error(`${WARMUP_DEPLOY_STEP_NAME} must not use the consumer token`);
  }
  if (!warmupDeploy.block.includes("workers/warmup/wrangler.jsonc")) {
    throw new Error(
      `${WARMUP_DEPLOY_STEP_NAME} must deploy workers/warmup/wrangler.jsonc`,
    );
  }
  if (warmupDeploy.block.includes("continue-on-error")) {
    throw new Error(`${WARMUP_DEPLOY_STEP_NAME} must not use continue-on-error`);
  }
  if (warmupDeploy.block.includes("|| true")) {
    throw new Error(`${WARMUP_DEPLOY_STEP_NAME} must not mask failures with || true`);
  }
  if (warmupDeploy.block.match(/WARMUP_(FROM|SEEDS|ALERT_TO)/)) {
    throw new Error(
      `${WARMUP_DEPLOY_STEP_NAME} must not set warmup Worker secrets in CI`,
    );
  }
  if (
    warmupDeploy.block.match(/kv\s+key\s+put/i) ||
    warmupDeploy.block.includes('"enabled"')
  ) {
    throw new Error(
      `${WARMUP_DEPLOY_STEP_NAME} must not write WARMUP_STATE enabled in CI`,
    );
  }

  const warmupGuards = deployStepByName(steps, WARMUP_GUARDS_STEP_NAME);
  if (!warmupGuards.block.includes("warmup-production")) {
    throw new Error(`${WARMUP_GUARDS_STEP_NAME} must use --target warmup-production`);
  }
  if (!warmupGuards.block.includes("workers/warmup/wrangler.jsonc")) {
    throw new Error(
      `${WARMUP_GUARDS_STEP_NAME} must guard workers/warmup/wrangler.jsonc`,
    );
  }

  const consumerPrepare = deployStepByName(steps, CONSUMER_PREPARE_STEP_NAME);
  const consumerGuards = deployStepByName(steps, CONSUMER_GUARDS_STEP_NAME);
  assertConsumerPrepareSecretIsolation(
    consumerPrepare.block,
    CONSUMER_PREPARE_STEP_NAME,
  );
  if (consumerGuards.block.includes("secrets.")) {
    throw new Error(`${CONSUMER_GUARDS_STEP_NAME} must not reference secrets.*`);
  }
}

/** Deploy job steps as of DIDI-595 (must stay unchanged aside from `needs: plan`). */
const EXPECTED_DEPLOY_STEPS_BLOCK = `    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - name: Deploy-time guards (production, committed config)
        run: node scripts/check-deploy-guards.mjs --target production --config wrangler.jsonc
      - name: Deploy-time guards (production consumer, committed config)
        run: |
          node scripts/check-deploy-guards.mjs \\
            --target consumer-production \\
            --config workers/we-met-followup-email-consumer/wrangler.production.jsonc
      - name: Provision D1 and R2 (production)
        id: provision
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN_PRODUCTION }}
          CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          WE_MET_D1_DATABASE_ID_PRODUCTION: \${{ secrets.WE_MET_D1_DATABASE_ID_PRODUCTION }}
        run: |
          set -euo pipefail
          node scripts/provision-resources.mjs \\
            --target production \\
            --config wrangler.jsonc \\
            --output provision-d1-ids.json
      - name: Prepare Wrangler config (production D1 IDs)
        env:
          WE_MET_D1_DATABASE_ID_PRODUCTION: \${{ secrets.WE_MET_D1_DATABASE_ID_PRODUCTION }}
          WE_MET_PROVISION_D1_IDS_FILE: provision-d1-ids.json
        run: |
          set -euo pipefail
          node scripts/prepare-wrangler-config.mjs \\
            --target production \\
            --output wrangler.ci.jsonc
      - name: Deploy-time guards (production)
        run: node scripts/check-deploy-guards.mjs --target production --config wrangler.ci.jsonc
      - name: Prepare follow-up email consumer Wrangler config (production D1 ID)
        env:
          WE_MET_D1_DATABASE_ID_PRODUCTION: \${{ secrets.WE_MET_D1_DATABASE_ID_PRODUCTION }}
          WE_MET_PROVISION_D1_IDS_FILE: provision-d1-ids.json
        run: |
          set -euo pipefail
          node scripts/prepare-wrangler-config.mjs \\
            --target consumer-production \\
            --output workers/we-met-followup-email-consumer/wrangler.production.ci.jsonc
      - name: Deploy-time guards (production consumer)
        run: |
          node scripts/check-deploy-guards.mjs \\
            --target consumer-production \\
            --config workers/we-met-followup-email-consumer/wrangler.production.ci.jsonc
      - name: Deploy-time guards (production warmup)
        run: |
          node scripts/check-deploy-guards.mjs \\
            --target warmup-production \\
            --config workers/warmup/wrangler.jsonc
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

  it("runs consumer prepare and guards before app build or deploy", () => {
    const deploySection = workflow.match(/^  deploy:[\s\S]*$/m)?.[0] ?? "";
    const productionGuardsIdx = deploySection.indexOf(
      "Deploy-time guards (production)",
    );
    const consumerPrepareIdx = deploySection.indexOf(
      "Prepare follow-up email consumer",
    );
    const consumerGuardsIdx = deploySection.indexOf(
      "Deploy-time guards (production consumer)",
    );
    const warmupGuardsIdx = deploySection.indexOf(WARMUP_GUARDS_STEP_NAME);
    const turnstileIdx = deploySection.indexOf("Require production Turnstile site key");
    const migrationsIdx = deploySection.indexOf(MIGRATIONS_STEP_NAME);
    const appDeployIdx = deploySection.indexOf("opennextjs-cloudflare deploy");
    const consumerDeployIdx = deploySection.indexOf(
      "Deploy follow-up email consumer to production",
    );
    const warmupDeployIdx = deploySection.indexOf(WARMUP_DEPLOY_STEP_NAME);
    expect(productionGuardsIdx).toBeGreaterThan(-1);
    expect(consumerPrepareIdx).toBeGreaterThan(productionGuardsIdx);
    expect(consumerGuardsIdx).toBeGreaterThan(consumerPrepareIdx);
    expect(warmupGuardsIdx).toBeGreaterThan(consumerGuardsIdx);
    expect(turnstileIdx).toBeGreaterThan(warmupGuardsIdx);
    expect(migrationsIdx).toBeGreaterThan(warmupGuardsIdx);
    expect(appDeployIdx).toBeGreaterThan(turnstileIdx);
    expect(consumerDeployIdx).toBeGreaterThan(appDeployIdx);
    expect(warmupDeployIdx).toBeGreaterThan(consumerDeployIdx);
    expect(deploySection).not.toContain("WE_MET_TEST_MAIL_TO");
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

  it("does not pass production D1 id through GitHub variables (log leak)", () => {
    const deploySection = extractDeployJobSection(workflow);
    expect(findVarsD1DatabaseIdReference(deploySection)).toBeNull();
    expect(deploySection).toContain("secrets.WE_MET_D1_DATABASE_ID_PRODUCTION");
  });

  it("isolates Cloudflare API tokens across deploy job steps", () => {
    assertDeployJobCloudflareTokenIsolation(extractDeployJobSection(workflow));
  });

  it("consumer prepare secret isolation rejects disguised Cloudflare secret references", () => {
    const steps = splitDeployJobSteps(extractDeployJobSection(workflow));
    const prepare = deployStepByName(steps, CONSUMER_PREPARE_STEP_NAME);
    const withLowercaseToken = prepare.block.replace(
      "WE_MET_PROVISION_D1_IDS_FILE: provision-d1-ids.json",
      "EXTRA: ${{ secrets.cloudflare_api_token_production }}",
    );
    expect(() =>
      assertConsumerPrepareSecretIsolation(
        withLowercaseToken,
        CONSUMER_PREPARE_STEP_NAME,
      ),
    ).toThrow(/cloudflare/i);

    const withBracketToken = prepare.block.replace(
      "secrets.WE_MET_D1_DATABASE_ID_PRODUCTION",
      "secrets['CLOUDFLARE_API_TOKEN_PRODUCTION']",
    );
    expect(() =>
      assertConsumerPrepareSecretIsolation(
        withBracketToken,
        CONSUMER_PREPARE_STEP_NAME,
      ),
    ).toThrow(/bracket/i);

    const withToJson = `${prepare.block}\n          FOO: \${{ toJSON(secrets) }}`;
    expect(() =>
      assertConsumerPrepareSecretIsolation(withToJson, CONSUMER_PREPARE_STEP_NAME),
    ).toThrow(/toJSON/i);
  });

  it("token isolation self-check rejects consumer token on the app deploy step", () => {
    const steps = splitDeployJobSteps(extractDeployJobSection(workflow));
    const appIdx = steps.findIndex((s) => s.name === APP_DEPLOY_STEP_NAME);
    expect(appIdx).toBeGreaterThan(-1);
    const mutated = steps.map((step, index) =>
      index === appIdx
        ? {
            ...step,
            block: step.block.replaceAll(
              "CLOUDFLARE_API_TOKEN_PRODUCTION",
              "CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION",
            ),
          }
        : step,
    );
    const fakeSection = `    steps:\n${mutated.map((s) => s.block).join("\n")}`;
    expect(() => assertDeployJobCloudflareTokenIsolation(fakeSection)).toThrow(
      APP_DEPLOY_STEP_NAME,
    );
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
