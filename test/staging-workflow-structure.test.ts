import { readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const WORKFLOW_PATH = ".github/workflows/deploy-staging.yml";
const GOOGLE_SMOKE_STEP = "Smoke check Google OAuth client ids differ";
const DEPLOY_STEP = "Deploy Worker to staging";
const BUILD_STEP = "Build OpenNext (staging)";
const GUARD_CI_CONFIG_STEP = "Deploy-time guards (staging)";
const GUARD_BUILD_STEP = "Deploy-time guards (staging build env)";
const PREPARE_STEP = "Prepare Wrangler config (staging D1 ID)";
const MIGRATIONS_STEP = "Apply staging D1 migrations";
const GUARDS_SCRIPT = "scripts/check-deploy-guards.mjs";
const PREPARE_SCRIPT = "scripts/prepare-wrangler-config.mjs";
const SMOKE_SCRIPT = "scripts/check-google-oauth-client-ids.mjs";

const FAKE_NONPROD_D1_ID = "22222222-2222-2222-2222-222222222222";

const STAGING_JOB_BUILD_ENV = {
  WE_MET_ENV: "staging",
  WE_MET_BASE_URL: "https://we-met.didi.build",
  WE_MET_PREVIEW_HOST_SUFFIX: "",
} as const;

const PRODUCTION_SECRET_OR_VAR_MARKERS = [
  "CLOUDFLARE_API_TOKEN_PRODUCTION",
  "CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION",
  "WE_MET_D1_DATABASE_ID_PRODUCTION",
  "WE_MET_TURNSTILE_SITE_KEY_PRODUCTION",
  "CLOUDFLARE_API_TOKEN_MIGRATE_NONPROD",
  "environment: production",
  "vars.WE_MET_TURNSTILE_SITE_KEY_PRODUCTION",
  "secrets.WE_MET_TURNSTILE_SITE_KEY_PRODUCTION",
  "deploy-production.yml",
  "--target production",
];

type DeployStepBlock = { name: string | null; block: string };

function extractDeployJobSection(workflow: string): string {
  return workflow.match(/^  deploy:[\s\S]*$/m)?.[0] ?? "";
}

function extractDeployJobEnvBlock(deploySection: string): string {
  const match = deploySection.match(/^    env:\n([\s\S]*?)^    steps:/m);
  return match?.[1] ?? "";
}

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

function stepByName(steps: DeployStepBlock[], name: string): DeployStepBlock {
  const step = steps.find((s) => s.name === name);
  if (!step) {
    throw new Error(`deploy job step named "${name}" not found`);
  }
  return step;
}

const tempOutputs: string[] = [];

afterEach(() => {
  for (const path of tempOutputs) {
    rmSync(path, { force: true });
  }
  tempOutputs.length = 0;
});

describe("Deploy staging workflow structure (unit)", () => {
  const workflow = readFileSync(WORKFLOW_PATH, "utf8");
  const deploySection = extractDeployJobSection(workflow);
  const steps = splitDeployJobSteps(deploySection);

  it("is triggered by push to main with production paths-ignore and workflow_dispatch", () => {
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("paths-ignore:");
    expect(workflow).toContain('- "docs/**"');
    expect(workflow).toContain('- "**/*.md"');
    expect(workflow).toContain("workflow_dispatch");
  });

  it("does not use pull_request or pull_request_target triggers", () => {
    expect(workflow).not.toMatch(/^\s+pull_request:/m);
    expect(workflow).not.toMatch(/^\s+pull_request_target:/m);
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).not.toMatch(/on:\s*\[.*pull_request/);
  });

  it("uses staging GitHub environment, concurrency, and main-only guard", () => {
    expect(deploySection).toMatch(/environment:\s*\n\s+name:\s+staging/);
    expect(deploySection).toContain("url: https://we-met.didi.build");
    expect(workflow).toContain("group: deploy-staging");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(deploySection).toMatch(/if:\s*github\.ref == 'refs\/heads\/main'/);
    expect(workflow).toContain("permissions:");
    expect(workflow).toContain("contents: read");
  });

  it("sets shared staging build env on the deploy job for guard and build steps", () => {
    const jobEnv = extractDeployJobEnvBlock(deploySection);
    expect(jobEnv).toContain("WE_MET_ENV: staging");
    expect(jobEnv).toContain("WE_MET_BASE_URL: https://we-met.didi.build");
    expect(jobEnv).toContain('WE_MET_PREVIEW_HOST_SUFFIX: ""');
    expect(jobEnv).not.toContain("WE_MET_D1_DATABASE_ID_NONPROD");
    const buildStep = stepByName(steps, BUILD_STEP);
    expect(buildStep.block).not.toContain("WE_MET_ENV:");
    expect(buildStep.block).toContain("WE_MET_COMMIT_SHA: ${{ github.sha }}");
    const guardBuild = stepByName(steps, GUARD_BUILD_STEP);
    expect(guardBuild.block).not.toMatch(/^\s+env:/m);
  });

  it("passes WE_MET_D1_DATABASE_ID_NONPROD into the prepared-config guard step", () => {
    const guardBlock = stepByName(steps, GUARD_CI_CONFIG_STEP).block;
    expect(guardBlock).toContain(
      "WE_MET_D1_DATABASE_ID_NONPROD: ${{ secrets.WE_MET_D1_DATABASE_ID_NONPROD }}",
    );
    expect(guardBlock).toContain("wrangler.staging.ci.jsonc");
  });

  it("runs opennext deploy with wrangler.staging.ci.jsonc only", () => {
    const deployBlock = stepByName(steps, DEPLOY_STEP).block;
    expect(deployBlock).toContain(
      "npx opennextjs-cloudflare deploy --config wrangler.staging.ci.jsonc",
    );
    expect(deployBlock).not.toContain("wrangler.ci.jsonc");
  });

  it("uses wrangler.staging.ci.jsonc for both D1 commands", () => {
    const migrationsBlock = stepByName(steps, MIGRATIONS_STEP).block;
    const applyMatches =
      migrationsBlock.match(
        /wrangler d1 migrations apply[\s\S]*--config wrangler\.staging\.ci\.jsonc/g,
      ) ?? [];
    const executeMatches =
      migrationsBlock.match(
        /wrangler d1 execute[\s\S]*--config wrangler\.staging\.ci\.jsonc/g,
      ) ?? [];
    expect(applyMatches.length).toBeGreaterThanOrEqual(1);
    expect(executeMatches.length).toBeGreaterThanOrEqual(1);
  });

  it("treats migration drift listing as warn-only after apply", () => {
    const migrationsBlock = stepByName(steps, MIGRATIONS_STEP).block;
    expect(migrationsBlock).toContain("APPLY_LOG=$(mktemp)");
    expect(migrationsBlock).toContain("grep -E '\\[code: [0-9]+\\]' \"$APPLY_LOG\"");
    expect(migrationsBlock).toContain("DRIFT_STDERR=$(mktemp)");
    expect(migrationsBlock).toContain("<redacted-d1-id>");
    expect(migrationsBlock).toContain("set +e");
    expect(migrationsBlock).toContain("continuing deploy");
    expect(migrationsBlock).toContain("set -e");
  });

  it("does not reference production secrets or variables anywhere", () => {
    for (const marker of PRODUCTION_SECRET_OR_VAR_MARKERS) {
      expect(workflow).not.toContain(marker);
    }
  });

  it("does not deploy warmup or follow-up consumer Workers", () => {
    expect(workflow).not.toContain("workers/warmup");
    expect(workflow).not.toContain("we-met-followup-email-consumer");
  });

  it("runs Google OAuth smoke after deploy without calling production hosts", () => {
    const deployIdx = workflow.indexOf(DEPLOY_STEP);
    const smokeIdx = workflow.indexOf(GOOGLE_SMOKE_STEP);
    expect(deployIdx).toBeGreaterThan(-1);
    expect(smokeIdx).toBeGreaterThan(deployIdx);
    expect(workflow).toContain(SMOKE_SCRIPT);
    expect(workflow).not.toContain("app.we-met.link");
    const smokeScript = readFileSync(SMOKE_SCRIPT, "utf8");
    expect(smokeScript).not.toContain("app.we-met.link");
    expect(smokeScript).toContain("we-met.didi.build");
  });

  it("prepare then staging guards on ci config matches workflow env for non-prod D1 id", () => {
    const prepareBlock = stepByName(steps, PREPARE_STEP).block;
    expect(prepareBlock).toContain(
      "WE_MET_D1_DATABASE_ID_NONPROD: ${{ secrets.WE_MET_D1_DATABASE_ID_NONPROD }}",
    );

    const output = `wrangler.staging.workflow-test-${process.pid}.ci.jsonc`;
    tempOutputs.push(output);

    const prepare = spawnSync(
      "node",
      [PREPARE_SCRIPT, "--target", "staging", "--output", output],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          WE_MET_D1_DATABASE_ID_NONPROD: FAKE_NONPROD_D1_ID,
        },
      },
    );
    expect(prepare.status).toBe(0);

    const guardWithSecret = spawnSync(
      "node",
      [GUARDS_SCRIPT, "--target", "staging", "--config", output],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          WE_MET_D1_DATABASE_ID_NONPROD: FAKE_NONPROD_D1_ID,
        },
      },
    );
    expect(guardWithSecret.status).toBe(0);

    const envWithoutNonprodD1 = { ...process.env };
    delete envWithoutNonprodD1.WE_MET_D1_DATABASE_ID_NONPROD;
    const guardWithoutSecret = spawnSync(
      "node",
      [GUARDS_SCRIPT, "--target", "staging", "--config", output],
      {
        encoding: "utf8",
        env: envWithoutNonprodD1,
      },
    );
    expect(guardWithoutSecret.status).toBe(1);
    expect(guardWithoutSecret.stderr).toContain("non-prod placeholder");
  });

  it("requires job-level WE_MET_ENV for staging-build guards to pass", () => {
    const envMissingWeMetEnv = { ...process.env };
    delete envMissingWeMetEnv.WE_MET_ENV;
    envMissingWeMetEnv.WE_MET_BASE_URL = STAGING_JOB_BUILD_ENV.WE_MET_BASE_URL;
    envMissingWeMetEnv.WE_MET_PREVIEW_HOST_SUFFIX =
      STAGING_JOB_BUILD_ENV.WE_MET_PREVIEW_HOST_SUFFIX;
    const result = spawnSync("node", [GUARDS_SCRIPT, "--target", "staging-build"], {
      encoding: "utf8",
      env: envMissingWeMetEnv,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('staging build requires WE_MET_ENV "staging"');
  });
});
