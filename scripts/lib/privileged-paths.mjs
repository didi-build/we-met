/**
 * Paths whose changes can reach privileged credentials or deploy infrastructure.
 * Read from trusted code on `main` (pull_request_target workflow).
 */

/** @type {readonly { id: string; test: (filename: string) => boolean }[]} */
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
    id: "open-next-config",
    test: (filename) => /^open-next\.config\./.test(filename),
  },
  {
    id: "migrations",
    test: (filename) => filename.startsWith("migrations/"),
  },
  {
    id: "privileged-change-scripts",
    test: (filename) => /^scripts\/privileged-change-[^/]+\.mjs$/.test(filename),
  },
  {
    id: "privileged-lib",
    test: (filename) => /^scripts\/lib\/privileged-[^/]+\.mjs$/.test(filename),
  },
  {
    id: "secret-usage",
    test: (filename) => filename === "scripts/check-secret-usage.mjs",
  },
];

export const privilegedPathsConfigPath = "scripts/lib/privileged-paths.mjs";

export const privilegedChangeWorkflowPath = ".github/workflows/privileged-change.yml";

export const secretUsageScriptPath = "scripts/check-secret-usage.mjs";

/**
 * Paths that implement or configure the privileged-change flag (high severity when edited).
 *
 * @param {string} filename
 * @returns {boolean}
 */
export function isPrivilegedFlagInfrastructurePath(filename) {
  if (filename === privilegedPathsConfigPath) {
    return true;
  }
  if (filename === privilegedChangeWorkflowPath) {
    return true;
  }
  if (filename === secretUsageScriptPath) {
    return true;
  }
  if (/^scripts\/privileged-change-[^/]+\.mjs$/.test(filename)) {
    return true;
  }
  if (/^scripts\/lib\/privileged-[^/]+\.mjs$/.test(filename)) {
    return true;
  }
  return false;
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
