import { spawnSync } from "node:child_process";

/**
 * @param {string} detail
 * @param {string} previewName
 * @returns {boolean}
 */
export function isPreviewMissingError(detail, previewName) {
  const raw = previewName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const encoded = encodeURIComponent(previewName).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const nameInUrl = raw === encoded ? raw : `(?:${raw}|${encoded})`;
  const apiLine = new RegExp(
    `A request to the Cloudflare API \\(/accounts/[^)]+/workers/workers/[^/]+/previews/${nameInUrl}\\) failed\\.`,
  );
  return apiLine.test(detail) && /\[code:\s*10025\]/.test(detail);
}

/**
 * @param {string} name
 * @param {import("node:child_process").SpawnSyncOptionsWithStringEncoding} [spawnOptions]
 * @returns {number}
 */
export function deletePreviewByName(name, spawnOptions = {}) {
  const args = ["wrangler", "preview", "delete", "--name", name, "--skip-confirmation"];
  const config = process.env.WRANGLER_PREVIEW_CONFIG;
  if (config) {
    args.push("--config", config);
  }
  if (process.env.WRANGLER_PREVIEW_WORKER_NAME) {
    args.push("--worker-name", process.env.WRANGLER_PREVIEW_WORKER_NAME);
  }
  if (process.env.WRANGLER_PREVIEW_IGNORE_BASE_CONFIG === "true") {
    args.push("--ignore-base-config");
  }
  const result = spawnSync("npx", args, {
    encoding: "utf8",
    env: process.env,
    ...spawnOptions,
  });

  if (result.status === 0) {
    console.log(`Deleted preview ${name}.`);
    return 0;
  }

  const detail = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  if (isPreviewMissingError(detail, name)) {
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
