import { createHash } from "node:crypto";

/**
 * @param {string} content
 */
export function hashFileContent(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Stable hash over migration paths and contents (paths sorted).
 * @param {{ path: string, content: string }[]} files
 */
export function hashMigrationFiles(files) {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const canonical = sorted.map((f) => `${f.path}\n${f.content}`).join("\n---\n");
  return hashFileContent(canonical);
}
