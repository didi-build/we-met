import { describe, expect, it } from "vitest";
import {
  isPrivilegedFlagInfrastructurePath,
  isPrivilegedPath,
  privilegedPathMatchers,
} from "../scripts/lib/privileged-paths.mjs";

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
    { path: "scripts/lib/theme-color-scan.mjs", privileged: false },
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
    { path: "scripts/preview-comment-body.mjs", privileged: false },
    { path: "package.json", privileged: false },
  ];

  for (const { path, privileged } of cases) {
    it(`${path} privileged=${privileged}`, () => {
      expect(isPrivilegedPath(path)).toBe(privileged);
    });
  }

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
    ]);
  });
});
