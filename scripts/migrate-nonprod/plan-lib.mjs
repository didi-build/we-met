import { hashFileContent } from "./hash.mjs";

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
