import { describe, expect, it } from "vitest";
import {
  isPrivilegedFlagInfrastructurePath,
  isPrivilegedPath,
  privilegedPathMatchers,
  workflowModuleExactPrivilegedEntries,
} from "../scripts/lib/privileged-paths.mjs";

/** Pinned severities for workflow-module matchers (DIDI-973 QA). */
const WORKFLOW_MODULE_SEVERITIES_LITERAL: readonly (readonly [string, boolean])[] = [
  ["scripts/lib/preview-login-guard.mjs", true],
  ["scripts/lib/assert-repo-root-output.mjs", true],
  ["scripts/lib/d1-id-resolution.mjs", true],
  ["scripts/lib/provision-resources.mjs", true],
  ["scripts/lib/cloudflare-provision-api.mjs", true],
  ["scripts/lib/provision-run.mjs", true],
  ["scripts/provision-resources.mjs", true],
  ["scripts/lib/bootstrap.mjs", true],
  ["scripts/bootstrap.mjs", true],
  ["scripts/lib/dependabot-label.mjs", false],
  ["scripts/ensure-dependabot-label.mjs", false],
  ["scripts/verify-preview-nonprod-resources.mjs", true],
  ["scripts/lib/preview-nonprod-resource-gate.mjs", true],
  ["scripts/staging-d1-migration-drift.mjs", true],
  ["scripts/lib/staging-d1-migration-drift.mjs", true],
  ["scripts/wrangler-preview-delete.mjs", true],
  ["scripts/lib/wrangler-preview-delete-lib.mjs", true],
  ["scripts/check-google-oauth-client-ids.mjs", true],
  ["scripts/lib/google-oauth-client-id-smoke.mjs", false],
  ["src/migrations/expand-only-lint.ts", true],
  ["scripts/verify-action-pins.mjs", false],
  ["scripts/deploy-production/advisory-lint.ts", true],
  ["scripts/deploy-production/attribution.mjs", false],
  ["scripts/deploy-production/baseline.mjs", true],
  ["scripts/deploy-production/compare-migrations.mjs", true],
  ["scripts/deploy-production/compare-pages.mjs", true],
  ["scripts/deploy-production/failure-classification.mjs", true],
  ["scripts/deploy-production/messages.mjs", false],
  ["scripts/deploy-production/plan-soft-fail.mjs", true],
  ["scripts/deploy-production/plan.ts", true],
  ["scripts/deploy-production/report-setup-failure.mjs", true],
  ["scripts/deploy-production/workflow-output.mjs", false],
  ["scripts/migrate-nonprod/apply-guard.mjs", true],
  ["scripts/migrate-nonprod/apply-output.mjs", false],
  ["scripts/migrate-nonprod/apply.ts", true],
  ["scripts/migrate-nonprod/comment-body.mjs", false],
  ["scripts/migrate-nonprod/gh-api-comments.mjs", false],
  ["scripts/migrate-nonprod/gh-comment.mjs", false],
  ["scripts/migrate-nonprod/hash.mjs", false],
  ["scripts/migrate-nonprod/markdown-fence.mjs", false],
  ["scripts/migrate-nonprod/plan-lib.mjs", true],
  ["scripts/migrate-nonprod/plan.ts", true],
  ["scripts/migrate-nonprod/redact.mjs", false],
  ["scripts/migrate-nonprod/sanitize-for-comment.mjs", false],
  ["scripts/migrate-nonprod/validate.mjs", true],
  ["scripts/check-attribution.mjs", false],
  ["scripts/check-consumer-email-bundle.mjs", false],
  ["scripts/check-email-templates-generated.mjs", false],
  ["scripts/check-placeholders.mjs", false],
  ["scripts/check-theme-colors.mjs", false],
  ["scripts/check-warmup-no-emails.mjs", false],
  ["scripts/check-workflow-d1-id-secrets.mjs", false],
  ["scripts/check-workflow-provision-policy.mjs", true],
  ["scripts/ci-test-summary.mjs", false],
  ["scripts/clean-gallery-dist.mjs", false],
  ["scripts/dry-run-staging-config.mjs", false],
  ["scripts/gallery-preview-mode.mjs", false],
  ["scripts/gallery-preview-summary.mjs", false],
  ["scripts/generate-email-templates.mjs", false],
  ["scripts/lib/gallery-assets-root.mjs", false],
  ["scripts/lib/gallery-preview-mode.mjs", false],
  ["scripts/lib/launchpad-attribution.mjs", false],
  ["scripts/lib/theme-color-scan.mjs", false],
  ["scripts/write-gallery-root-headers.mjs", false],
  ["scripts/parse-wrangler-preview-json.mjs", false],
  ["scripts/preview-comment-body.mjs", false],
  ["scripts/init-project.mjs", false],
  ["scripts/repo-settings.mjs", true],
  ["scripts/lib/repo-settings-target.mjs", true],
];

describe("privileged-paths (table)", () => {
  const cases: { path: string; privileged: boolean }[] = [
    { path: ".github/workflows/ci.yml", privileged: true },
    { path: "scripts/check-deploy-guards.mjs", privileged: true },
    { path: "scripts/check-gallery-guards.mjs", privileged: true },
    { path: "scripts/lib/check-gallery-guards-lib.mjs", privileged: true },
    { path: "scripts/apply-migrations.mjs", privileged: true },
    { path: "scripts/prepare-wrangler-config.mjs", privileged: true },
    { path: "scripts/dry-run-generated-config.mjs", privileged: true },
    { path: "wrangler.jsonc", privileged: true },
    { path: "wrangler.ci.jsonc", privileged: true },
    {
      path: "workers/we-met-followup-email-consumer/wrangler.production.jsonc",
      privileged: true,
    },
    {
      path: "workers/we-met-followup-email-consumer/wrangler.nonprod.jsonc",
      privileged: true,
    },
    { path: "scripts/lib/queue-retry-policy.mjs", privileged: true },
    { path: "open-next.config.ts", privileged: true },
    { path: "migrations/0001_init.sql", privileged: true },
    { path: "scripts/privileged-change-github.mjs", privileged: true },
    { path: "scripts/lib/privileged-paths.mjs", privileged: true },
    { path: "scripts/lib/privileged-pull-files-api.mjs", privileged: true },
    { path: "scripts/lib/privileged-gh-api.mjs", privileged: true },
    { path: "scripts/lib/gh-api-errors.mjs", privileged: true },
    { path: "scripts/check-secret-usage.mjs", privileged: true },
    { path: "scripts/dependabot-automerge.mjs", privileged: true },
    { path: "scripts/check-actions-policy-workflows.mjs", privileged: true },
    { path: "scripts/lib/workflow-permissions-parse.mjs", privileged: true },
    { path: "scripts/activate-staging-account.mjs", privileged: true },
    { path: "scripts/lib/activate-staging-account.mjs", privileged: true },
    { path: "scripts/lib/wrangler-placeholders.mjs", privileged: true },
    { path: "scripts/lib/parse-jsonc.mjs", privileged: true },
    { path: "scripts/lib/workflow-permissions-parse.test.mjs", privileged: false },
    { path: "scripts/lib/workflow-permissions.mjs", privileged: false },
    { path: "scripts/activate-staging-account.mjs.bak", privileged: false },
    { path: "test/activate-staging-account.test.ts", privileged: false },
    { path: "scripts/lib/activate-staging-account.test.mjs", privileged: false },
    { path: "scripts/lib/activate-staging-account.mjs.bak", privileged: false },
    { path: "scripts/lib/wrangler-placeholders.test.mjs", privileged: false },
    { path: "scripts/lib/wrangler-placeholders.mjs.bak", privileged: false },
    { path: "scripts/lib/wrangler-placeholder.mjs", privileged: false },
    { path: "scripts/lib/parse-jsonc.test.mjs", privileged: false },
    { path: "scripts/lib/parse-jsonc.mjs.bak", privileged: false },
    { path: "scripts/lib/parse-json.mjs", privileged: false },
    { path: "scripts/lib/workflow-permissions-parse.mjs.bak", privileged: false },
    { path: "scripts/workflow-permissions-parse.mjs", privileged: false },
    { path: "scripts/wrangler-placeholders.mjs", privileged: false },
    { path: "scripts/parse-jsonc.mjs", privileged: false },
    { path: "scripts/lib/vendor/parse-jsonc.mjs", privileged: false },
    { path: "scripts/lib/vendor/activate-staging-account.mjs", privileged: false },
    { path: "src/lib/wrangler-placeholders.mjs", privileged: false },
    { path: "workers/warmup/scripts/activate-staging-account.mjs", privileged: false },
    {
      path: "workers/warmup/scripts/lib/activate-staging-account.mjs",
      privileged: false,
    },
    { path: "./scripts/lib/parse-jsonc.mjs", privileged: false },
    { path: "scripts/lib/Parse-JSONC.mjs", privileged: false },
    { path: "scripts/Activate-Staging-Account.mjs", privileged: false },
    { path: "scripts/lib/Activate-Staging-Account.mjs", privileged: false },
    { path: "scripts/lib/Wrangler-Placeholders.mjs", privileged: false },
    {
      path: "scripts/lib/Workflow-Permissions-Parse.mjs",
      privileged: false,
    },
    { path: "src/app/page.tsx", privileged: false },
    { path: "package.json", privileged: false },
  ];

  for (const { path, privileged } of cases) {
    it(`${path} privileged=${privileged}`, () => {
      expect(isPrivilegedPath(path)).toBe(privileged);
    });
  }

  describe("workflow module matchers (DIDI-973)", () => {
    it("privileged-paths-workflow-modules matches pinned severities", () => {
      expect(
        workflowModuleExactPrivilegedEntries.map((entry) => [
          entry.path,
          entry.infrastructure,
        ]),
      ).toEqual(WORKFLOW_MODULE_SEVERITIES_LITERAL);
    });

    for (const [path, infrastructure] of WORKFLOW_MODULE_SEVERITIES_LITERAL) {
      it(`${path} privileged=true infrastructure=${infrastructure}`, () => {
        expect(isPrivilegedPath(path)).toBe(true);
        expect(isPrivilegedFlagInfrastructurePath(path)).toBe(infrastructure);
      });
    }

    for (const [path] of WORKFLOW_MODULE_SEVERITIES_LITERAL) {
      it(`near-miss ${path}.bak is not privileged`, () => {
        expect(isPrivilegedPath(`${path}.bak`)).toBe(false);
      });
      if (path.startsWith("scripts/lib/")) {
        const wrongDir = `scripts/${path.slice("scripts/lib/".length)}`;
        if (
          !WORKFLOW_MODULE_SEVERITIES_LITERAL.some(
            ([listedPath]) => listedPath === wrongDir,
          )
        ) {
          it(`near-miss ${wrongDir} is not privileged`, () => {
            expect(isPrivilegedPath(wrongDir)).toBe(false);
          });
        }
      }
    }
  });

  it("wrong-directory paths are not infrastructure matchers", () => {
    expect(
      isPrivilegedFlagInfrastructurePath("scripts/workflow-permissions-parse.mjs"),
    ).toBe(false);
    expect(isPrivilegedFlagInfrastructurePath("./scripts/lib/parse-jsonc.mjs")).toBe(
      false,
    );
  });

  it("documents matcher ids for review", () => {
    expect(privilegedPathMatchers.map((m) => m.id)).toEqual([
      "github-tree",
      "deploy-guards",
      "gallery-guards",
      "migrate-script",
      "deploy-prepare-wrangler",
      "deploy-dry-run-generated",
      "wrangler-config",
      "consumer-wrangler-config",
      "queue-retry-policy",
      "open-next-config",
      "migrations",
      "privileged-change-scripts",
      "privileged-lib",
      "secret-usage",
      "dependabot-automerge",
      "actions-policy-workflows",
      "gh-api-errors",
      "workflow-permissions-parse",
      "activate-staging-account",
      "activate-staging-account-lib",
      "wrangler-placeholders",
      "parse-jsonc",
      "privileged-change-workflow",
      ...workflowModuleExactPrivilegedEntries.map((entry) => entry.id),
    ]);
  });
});
