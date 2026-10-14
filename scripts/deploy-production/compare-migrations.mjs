import { normalizePullFileEntry } from "../lib/privileged-pull-files-api.mjs";

/**
 * GitHub compare responses include at most this many changed files.
 * UNVERIFIED: exact cap and truncation behavior for this API in production use.
 */
export const GITHUB_COMPARE_CHANGED_FILES_CAP = 300;

const MIGRATION_PREFIX = "migrations/";
const MIGRATION_SUFFIX = ".sql";

/**
 * @param {string} filename
 * @returns {boolean}
 */
export function isMigrationSqlPath(filename) {
  return (
    filename.startsWith(MIGRATION_PREFIX) &&
    filename.endsWith(MIGRATION_SUFFIX) &&
    filename.length > MIGRATION_PREFIX.length + MIGRATION_SUFFIX.length - 1
  );
}

/**
 * @param {{ filename: string; status: string; previous_filename?: string }[]} rawFiles
 * @returns {{ filename: string; status: string; previous_filename?: string }[]}
 */
export function normalizeCompareFiles(rawFiles) {
  return rawFiles.map((entry, index) => ({
    ...normalizePullFileEntry(entry, index),
    previous_filename:
      entry && typeof entry === "object" && typeof entry.previous_filename === "string"
        ? entry.previous_filename
        : undefined,
  }));
}

/**
 * @param {{ filename: string; status: string }[]} files
 * @returns {{ path: string; changeKind: "added" | "changed"; previousPath?: string }[]}
 */
export function selectMigrationChangesFromCompare(files) {
  const selected = [];
  for (const file of files) {
    if (!isMigrationSqlPath(file.filename)) {
      continue;
    }
    if (file.status === "removed") {
      continue;
    }
    if (file.status === "added") {
      selected.push({ path: file.filename, changeKind: "added" });
      continue;
    }
    if (file.status === "modified" || file.status === "renamed") {
      selected.push({
        path: file.filename,
        changeKind: "changed",
        previousPath: file.previous_filename,
      });
    }
  }
  return selected.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * @param {{ status?: string; ahead_by?: number; behind_by?: number }} compare
 * @returns {boolean}
 */
export function isCleanAheadCompare(compare) {
  if ((compare.behind_by ?? 0) > 0) {
    return false;
  }
  const status = compare.status;
  if (status === "ahead") {
    return true;
  }
  if (status === "identical") {
    return (compare.ahead_by ?? 0) === 0;
  }
  return false;
}

/**
 * @param {number} compareFileCount
 * @returns {boolean}
 */
export function isCompareFileListNearCap(compareFileCount) {
  return compareFileCount >= GITHUB_COMPARE_CHANGED_FILES_CAP;
}

/**
 * @param {string[]} sortedPaths
 * @returns {{ path: string; changeKind: "listed" }[]}
 */
export function allMigrationsAsListed(sortedPaths) {
  return sortedPaths
    .filter(isMigrationSqlPath)
    .sort((a, b) => a.localeCompare(b))
    .map((path) => ({ path, changeKind: "listed" }));
}

/**
 * @typedef {{
 *   mode: "compare";
 *   migrations: { path: string; changeKind: "added" | "changed"; previousPath?: string }[];
 *   fallbackReason?: string;
 * }} CompareMigrationPlan
 * @typedef {{
 *   mode: "list_all";
 *   migrations: { path: string; changeKind: "listed" }[];
 *   fallbackReason: string;
 * }} ListAllMigrationPlan
 */

/**
 * @param {{
 *   baselineSha: string | null;
 *   compare: { status?: string; ahead_by?: number; behind_by?: number; files?: unknown[] } | null;
 *   allMigrationPathsAtHead: string[];
 * }} input
 * @returns {CompareMigrationPlan | ListAllMigrationPlan}
 */
export function decideMigrationPlan(input) {
  const { baselineSha, compare, allMigrationPathsAtHead } = input;

  if (!baselineSha) {
    return {
      mode: "list_all",
      migrations: allMigrationsAsListed(allMigrationPathsAtHead),
      fallbackReason:
        "No previous successful production deployment found, listing all migrations",
    };
  }

  if (!compare) {
    return {
      mode: "list_all",
      migrations: allMigrationsAsListed(allMigrationPathsAtHead),
      fallbackReason: "Compare API returned no result, listing all migrations",
    };
  }

  const rawFiles = Array.isArray(compare.files) ? compare.files : [];
  const fileCount = rawFiles.length;
  const normalized = normalizeCompareFiles(rawFiles);

  if (!isCleanAheadCompare(compare)) {
    return {
      mode: "list_all",
      migrations: allMigrationsAsListed(allMigrationPathsAtHead),
      fallbackReason: `Compare result is not a clean ahead-only history (status: ${compare.status ?? "unknown"}), listing all migrations`,
    };
  }

  if (isCompareFileListNearCap(fileCount)) {
    return {
      mode: "list_all",
      migrations: allMigrationsAsListed(allMigrationPathsAtHead),
      fallbackReason: "Compare result may be truncated, listing all migrations",
    };
  }

  return {
    mode: "compare",
    migrations: selectMigrationChangesFromCompare(normalized),
  };
}
