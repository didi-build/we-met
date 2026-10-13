import { hashFileContent } from "./hash.mjs";

export const MIGRATION_FILENAME_RE = /^migrations\/[A-Za-z0-9._-]+\.sql$/;

/**
 * @param {string} filename
 * @returns {{ ok: true } | { ok: false; message: string }}
 */
export function validateMigrationFilename(filename) {
  if (!MIGRATION_FILENAME_RE.test(filename)) {
    return {
      ok: false,
      message: `Invalid migration filename (must match migrations/[A-Za-z0-9._-]+.sql): ${filename}`,
    };
  }
  return { ok: true };
}

/**
 * @param {{
 *   appliedHash: string | null;
 *   migrationHash: string;
 *   immutability: { ok: true } | { ok: false; message: string };
 * }} input
 * @returns {
 *   | { kind: "failed"; message: string }
 *   | { kind: "skipped" }
 *   | { kind: "waiting" }
 * }
 */
export function decidePlanCommentState({ appliedHash, migrationHash, immutability }) {
  if (!immutability.ok) {
    return { kind: "failed", message: immutability.message };
  }
  if (appliedHash === migrationHash) {
    return { kind: "skipped" };
  }
  return { kind: "waiting" };
}

/**
 * @param {{ filename: string; status: string }[]} pullFiles
 */
export function findDisallowedMigrationFileChanges(pullFiles) {
  return pullFiles.filter(
    (f) =>
      f.filename.startsWith("migrations/") &&
      f.filename.endsWith(".sql") &&
      (f.status === "modified" || f.status === "renamed" || f.status === "removed"),
  );
}

/**
 * @param {{ hash: string; files: Record<string, string> } | null} appliedState
 * @param {{ path: string; content: string }[]} currentFiles
 */
export function checkAppliedFileImmutability(appliedState, currentFiles) {
  if (!appliedState) {
    return { ok: true };
  }
  for (const [path, expectedHash] of Object.entries(appliedState.files)) {
    const current = currentFiles.find((f) => f.path === path);
    if (!current) {
      return {
        ok: false,
        message: `Applied migration file is missing at PR head: ${path}`,
      };
    }
    const actualHash = hashFileContent(current.content);
    if (actualHash !== expectedHash) {
      return {
        ok: false,
        message: `Applied migration file content changed (immutable): ${path}`,
      };
    }
  }
  return { ok: true };
}
