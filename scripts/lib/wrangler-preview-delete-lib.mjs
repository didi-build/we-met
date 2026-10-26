import { spawnSync } from "node:child_process";

/**
 * @param {string} detail
 * @returns {boolean}
 */
export function isPreviewMissingError(detail) {
  const lower = detail.toLowerCase();
  if (/\b404\b/.test(lower)) {
    return true;
  }
  return /preview[^\n]{0,120}not found/i.test(detail);
}

/**
 * @param {string} name
 * @param {import("node:child_process").SpawnSyncOptionsWithStringEncoding} [spawnOptions]
 * @returns {number}
 */
export function deletePreviewByName(name, spawnOptions = {}) {
  const result = spawnSync(
    "npx",
    ["wrangler", "preview", "delete", "--name", name, "--skip-confirmation"],
    {
      encoding: "utf8",
      env: process.env,
      ...spawnOptions,
    },
  );

  if (result.status === 0) {
    console.log(`Deleted preview ${name}.`);
    return 0;
  }

  const detail = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  if (isPreviewMissingError(detail)) {
    console.log(`Preview ${name} was not present; nothing to delete.`);
    return 0;
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  return result.status ?? 1;
}
