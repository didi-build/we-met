/**
 * Paths whose changes can reach privileged credentials or deploy infrastructure.
 * Read from trusted code on `main` (pull_request_target workflow).
 */

export const privilegedPathsConfigPath = "scripts/lib/privileged-paths.mjs";

export const privilegedChangeWorkflowPath = ".github/workflows/privileged-change.yml";

export const secretUsageScriptPath = "scripts/check-secret-usage.mjs";

export const ghApiErrorsPath = "scripts/lib/gh-api-errors.mjs";

/** @type {readonly { id: string; infrastructure?: boolean; test: (filename: string) => boolean }[]} */
export const privilegedPathMatchers = [
  {
    id: "github-tree",
    test: (filename) => filename.startsWith(".github/"),
  },
  {
    id: "deploy-guards",
    test: (filename) => filename === "scripts/check-deploy-guards.mjs",
  },
  {
    id: "migrate-script",
    test: (filename) => filename === "scripts/apply-migrations.mjs",
  },
  {
    id: "deploy-prepare-wrangler",
    test: (filename) => filename === "scripts/prepare-wrangler-config.mjs",
  },
  {
    id: "deploy-dry-run-generated",
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
    id: "open-next-config",
    test: (filename) => /^open-next\.config\./.test(filename),
  },
  {
    id: "migrations",
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
    id: "privileged-change-workflow",
    infrastructure: true,
    test: (filename) => filename === privilegedChangeWorkflowPath,
  },
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
