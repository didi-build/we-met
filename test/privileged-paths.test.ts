import { describe, expect, it } from "vitest";
import {
  isPrivilegedPath,
  privilegedPathMatchers,
} from "../scripts/lib/privileged-paths.mjs";

describe("privileged-paths (table)", () => {
  const cases: { path: string; privileged: boolean }[] = [
    { path: ".github/workflows/ci.yml", privileged: true },
    { path: "scripts/check-deploy-guards.mjs", privileged: true },
    { path: "scripts/apply-migrations.mjs", privileged: true },
    { path: "scripts/prepare-wrangler-config.mjs", privileged: true },
    { path: "scripts/dry-run-generated-config.mjs", privileged: true },
    { path: "wrangler.jsonc", privileged: true },
    { path: "wrangler.ci.jsonc", privileged: true },
    { path: "open-next.config.ts", privileged: true },
    { path: "migrations/0001_init.sql", privileged: true },
    { path: "scripts/privileged-change-github.mjs", privileged: true },
    { path: "scripts/lib/privileged-paths.mjs", privileged: true },
    { path: "scripts/lib/privileged-pull-files-api.mjs", privileged: true },
    { path: "scripts/lib/gh-api-errors.mjs", privileged: true },
    { path: "scripts/check-secret-usage.mjs", privileged: true },
    { path: "scripts/dependabot-automerge.mjs", privileged: true },
    { path: "scripts/check-actions-policy-workflows.mjs", privileged: true },
    { path: "src/app/page.tsx", privileged: false },
    { path: "scripts/preview-comment-body.mjs", privileged: false },
    { path: "package.json", privileged: false },
  ];

  for (const { path, privileged } of cases) {
    it(`${path} privileged=${privileged}`, () => {
      expect(isPrivilegedPath(path)).toBe(privileged);
    });
  }

  it("documents matcher ids for review", () => {
    expect(privilegedPathMatchers.map((m) => m.id)).toEqual([
      "github-tree",
      "deploy-guards",
      "migrate-script",
      "deploy-prepare-wrangler",
      "deploy-dry-run-generated",
      "wrangler-config",
      "open-next-config",
      "migrations",
      "privileged-change-scripts",
      "privileged-lib",
      "secret-usage",
      "dependabot-automerge",
      "actions-policy-workflows",
      "gh-api-errors",
      "privileged-change-workflow",
    ]);
  });
});
