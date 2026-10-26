import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {unknown} wranglerExecuteJson
 * @returns {string[]}
 */
export function parseAppliedMigrationNamesFromWranglerExecute(wranglerExecuteJson) {
  if (!Array.isArray(wranglerExecuteJson)) {
    return [];
  }
  const names = [];
  for (const batch of wranglerExecuteJson) {
    const results = batch?.results;
    if (!Array.isArray(results)) {
      continue;
    }
    for (const row of results) {
      const name = row?.name;
      if (typeof name === "string" && name.trim()) {
        names.push(name.trim());
      }
    }
  }
  return names;
}

/**
 * @param {string} migrationsDir
 * @returns {Set<string>}
 */
export function readRepoMigrationFilenames(migrationsDir) {
  const entries = readdirSync(migrationsDir, { withFileTypes: true });
  const names = new Set();
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".sql")) {
      names.add(entry.name);
    }
  }
  return names;
}

/**
 * Applied migrations on remote D1 that are not present in the repo migrations/ folder.
 *
 * @param {string[]} appliedNames
 * @param {Set<string>} repoFilenames
 * @returns {string[]}
 */
export function findRemoteOnlyAppliedMigrations(appliedNames, repoFilenames) {
  const orphans = [];
  for (const name of appliedNames) {
    if (!repoFilenames.has(name)) {
      orphans.push(name);
    }
  }
  return orphans.sort();
}

/**
 * @param {string[]} appliedNames
 * @returns {string}
 */
export function formatAppliedMigrationNamesForLog(appliedNames) {
  if (appliedNames.length === 0) {
    return "Applied D1 migrations: (none listed in d1_migrations)";
  }
  return ["Applied D1 migrations:", ...appliedNames.map((name) => `  - ${name}`)].join(
    "\n",
  );
}

/**
 * @param {string[]} remoteOnly
 * @returns {string}
 */
export function formatMigrationDriftMarkdown(remoteOnly) {
  if (remoteOnly.length === 0) {
    return "No remote-only D1 migrations (all applied names exist on main).";
  }
  const lines = [
    "**Warning:** remote `we-met-db-nonprod` has applied migrations not in this commit's `migrations/` (often from unmerged PRs via migrate-nonprod):",
    "",
    ...remoteOnly.map((name) => `- \`${name}\``),
  ];
  return lines.join("\n");
}

/**
 * @param {string} repoRoot
 * @param {unknown} wranglerExecuteJson
 * @returns {{ remoteOnly: string[]; markdown: string }}
 */
export function buildStagingMigrationDriftReport(repoRoot, wranglerExecuteJson) {
  const applied = parseAppliedMigrationNamesFromWranglerExecute(wranglerExecuteJson);
  const repoNames = readRepoMigrationFilenames(join(repoRoot, "migrations"));
  const remoteOnly = findRemoteOnlyAppliedMigrations(applied, repoNames);
  return {
    remoteOnly,
    markdown: formatMigrationDriftMarkdown(remoteOnly),
  };
}
