/**
 * Paths whose changes can reach privileged credentials or deploy infrastructure.
 * Read from trusted code on `main` (pull_request_target workflow).
 */

import { workflowModuleExactPrivilegedEntries } from "./privileged-paths-workflow-modules.mjs";

export const privilegedPathsConfigPath = "scripts/lib/privileged-paths.mjs";

export const privilegedChangeWorkflowPath = ".github/workflows/privileged-change.yml";

export const secretUsageScriptPath = "scripts/check-secret-usage.mjs";

export const ghApiErrorsPath = "scripts/lib/gh-api-errors.mjs";

export const workflowPermissionsParsePath =
  "scripts/lib/workflow-permissions-parse.mjs";

export const activateStagingAccountScriptPath = "scripts/activate-staging-account.mjs";

export const activateStagingAccountLibPath = "scripts/lib/activate-staging-account.mjs";

export const wranglerPlaceholdersPath = "scripts/lib/wrangler-placeholders.mjs";

export const parseJsoncPath = "scripts/lib/parse-jsonc.mjs";

/** @type {readonly { id: string; infrastructure?: boolean; test: (filename: string) => boolean }[]} */
const basePrivilegedPathMatchers = [
  {
    id: "github-tree",
    test: (filename) => filename.startsWith(".github/"),
  },
  {
    id: "deploy-guards",
    test: (filename) => filename === "scripts/check-deploy-guards.mjs",
  },
  {
    id: "gallery-guards",
    test: (filename) =>
      filename === "scripts/check-gallery-guards.mjs" ||
      filename === "scripts/lib/check-gallery-guards-lib.mjs",
  },
  {
    id: "migrate-script",
    infrastructure: true,
    test: (filename) => filename === "scripts/apply-migrations.mjs",
  },
  {
    id: "deploy-prepare-wrangler",
    test: (filename) => filename === "scripts/prepare-wrangler-config.mjs",
  },
  {
    id: "deploy-dry-run-generated",
    infrastructure: true,
    test: (filename) => filename === "scripts/dry-run-generated-config.mjs",
  },
  {
    id: "wrangler-config",
    test: (filename) => /^wrangler[^/]*\.jsonc$/.test(filename),
  },
  {
    id: "consumer-wrangler-config",
    test: (filename) =>
      filename.startsWith("workers/we-met-followup-email-consumer/wrangler") &&
      filename.endsWith(".jsonc"),
  },
  {
    id: "queue-retry-policy",
    test: (filename) => filename === "scripts/lib/queue-retry-policy.mjs",
  },
  {
    id: "open-next-config",
    test: (filename) => /^open-next\.config\./.test(filename),
  },
  {
    id: "migrations",
    infrastructure: true,
    test: (filename) => filename.startsWith("migrations/"),
  },
  {
    id: "privileged-change-scripts",
    infrastructure: true,
    test: (filename) => /^scripts\/privileged-change-[^/]+\.mjs$/.test(filename),
  },
  {
    id: "privileged-lib",
    infrastructure: true,
    test: (filename) => /^scripts\/lib\/privileged-[^/]+\.mjs$/.test(filename),
  },
  {
    id: "secret-usage",
    infrastructure: true,
    test: (filename) => filename === secretUsageScriptPath,
  },
  {
    id: "dependabot-automerge",
    infrastructure: true,
    test: (filename) => filename === "scripts/dependabot-automerge.mjs",
  },
  {
    id: "actions-policy-workflows",
    infrastructure: true,
    test: (filename) => filename === "scripts/check-actions-policy-workflows.mjs",
  },
  {
    id: "gh-api-errors",
    infrastructure: true,
    test: (filename) => filename === ghApiErrorsPath,
  },
  {
    id: "workflow-permissions-parse",
    infrastructure: true,
    test: (filename) => filename === workflowPermissionsParsePath,
  },
  {
    id: "activate-staging-account",
    infrastructure: true,
    test: (filename) => filename === activateStagingAccountScriptPath,
  },
  {
    id: "activate-staging-account-lib",
    infrastructure: true,
    test: (filename) => filename === activateStagingAccountLibPath,
  },
  {
    id: "wrangler-placeholders",
    infrastructure: true,
    test: (filename) => filename === wranglerPlaceholdersPath,
  },
  {
    id: "parse-jsonc",
    infrastructure: true,
    test: (filename) => filename === parseJsoncPath,
  },
  {
    id: "privileged-change-workflow",
    infrastructure: true,
    test: (filename) => filename === privilegedChangeWorkflowPath,
  },
];

export { workflowModuleExactPrivilegedEntries };

/** @type {readonly { id: string; infrastructure?: boolean; test: (filename: string) => boolean }[]} */
export const privilegedPathMatchers = [
  ...basePrivilegedPathMatchers,
  ...workflowModuleExactPrivilegedEntries.map(({ id, path, infrastructure }) => ({
    id,
    infrastructure,
    test: (filename) => filename === path,
  })),
];

/**
 * @param {string} filename
 * @returns {boolean}
 */
export function isPrivilegedFlagInfrastructurePath(filename) {
  return privilegedPathMatchers.some((m) => m.infrastructure && m.test(filename));
}

/**
 * @param {string} filename
 * @returns {boolean}
 */
export function isPrivilegedPath(filename) {
  return privilegedPathMatchers.some((m) => m.test(filename));
}

/**
 * @param {string} filename
 * @returns {boolean}
 */
export function isWorkflowFile(filename) {
  return (
    filename.startsWith(".github/workflows/") &&
    (filename.endsWith(".yml") || filename.endsWith(".yaml"))
  );
}
