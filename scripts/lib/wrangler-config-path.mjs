import { basename, resolve } from "node:path";

export const PREVIEW_CONFIG = "wrangler.preview.jsonc";
export const PREVIEW_CI_CONFIG = "wrangler.preview.ci.jsonc";

/** Basename pattern for prepare-wrangler-config preview Worker CI output (not arbitrary *.ci.jsonc). */
const PREPARED_PREVIEW_WORKER_CI_BASENAME = /^wrangler\.preview(\..*)?\.ci\.jsonc$/;

/**
 * @param {string} configPath
 * @returns {boolean}
 */
export function isPreparedPreviewWorkerCiConfigPath(configPath) {
  return PREPARED_PREVIEW_WORKER_CI_BASENAME.test(basename(resolve(configPath)));
}
export const GALLERY_PREVIEW_CONFIG = "wrangler.gallery.jsonc";
export const PRODUCTION_CONFIG = "wrangler.jsonc";

const APP_PREVIEW_CONFIGS = new Set([PREVIEW_CONFIG, PREVIEW_CI_CONFIG]);

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeWranglerConfigPath(raw) {
  if (!raw || typeof raw !== "string") {
    return "";
  }
  let path = raw.trim();
  if (
    (path.startsWith('"') && path.endsWith('"')) ||
    (path.startsWith("'") && path.endsWith("'"))
  ) {
    path = path.slice(1, -1).trim();
  }
  path = path.replace(/^\.\//, "");
  return path;
}

/**
 * @param {string | undefined} value
 * @returns {boolean}
 */
export function isAllowedPreviewWranglerConfig(value) {
  return normalizeWranglerConfigPath(value) === PREVIEW_CONFIG;
}

/**
 * Join shell lines continued with a trailing backslash.
 *
 * @param {string} script
 * @returns {string}
 */
export function joinShellContinuationLines(script) {
  if (!script) {
    return "";
  }
  const physical = script.split(/\r?\n/);
  const merged = [];
  let current = "";
  for (const line of physical) {
    if (current) {
      current += line.replace(/^\s*/, "");
    } else {
      current = line;
    }
    if (current.endsWith("\\")) {
      current = current.slice(0, -1);
      continue;
    }
    merged.push(current);
    current = "";
  }
  if (current) {
    merged.push(current);
  }
  return merged.join("\n");
}

/**
 * @param {string} commandText
 * @returns {string[]}
 */
export function collectWranglerConfigPaths(commandText) {
  const paths = [];
  const text = commandText.replace(/\s+/g, " ");
  let match;
  const eqRe = /--config=([^\s]+)/gi;
  while ((match = eqRe.exec(text)) !== null) {
    paths.push(match[1]);
  }
  const spacedRe = /(?:^|\s)(?:--config|-c)\s+([^\s]+)/gi;
  while ((match = spacedRe.exec(text)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

/**
 * @param {string[]} paths
 * @returns {string[]}
 */
export function validateWranglerConfigPaths(paths) {
  const violations = [];
  const normalized = paths.map((p) => normalizeWranglerConfigPath(p));
  const productionPaths = normalized.filter((p) => p === PRODUCTION_CONFIG);
  if (productionPaths.length > 0) {
    violations.push(`uses ${PRODUCTION_CONFIG} as wrangler config`);
  }
  if (normalized.length !== 1) {
    if (normalized.length === 0) {
      violations.push(
        "wrangler must pass exactly one -c/--config wrangler.preview.jsonc",
      );
    } else {
      violations.push(
        `wrangler must pass exactly one config path (found ${normalized.length})`,
      );
    }
    return violations;
  }
  const only = normalized[0];
  if (!APP_PREVIEW_CONFIGS.has(only)) {
    violations.push(
      `wrangler config must be ${PREVIEW_CONFIG} or ${PREVIEW_CI_CONFIG} (found "${only}")`,
    );
  }
  return violations;
}

/**
 * @param {string[]} paths
 * @returns {string[]}
 */
export function validateGalleryWranglerConfigPaths(paths) {
  const violations = [];
  const normalized = paths.map((p) => normalizeWranglerConfigPath(p));
  if (normalized.some((p) => p === PRODUCTION_CONFIG)) {
    violations.push(`uses ${PRODUCTION_CONFIG} as wrangler config`);
  }
  if (normalized.length !== 1) {
    if (normalized.length === 0) {
      violations.push(
        `wrangler must pass exactly one --config ${GALLERY_PREVIEW_CONFIG}`,
      );
    } else {
      violations.push(
        `wrangler must pass exactly one config path (found ${normalized.length})`,
      );
    }
    return violations;
  }
  const only = normalized[0];
  if (only !== GALLERY_PREVIEW_CONFIG) {
    violations.push(
      `gallery wrangler config must be ${GALLERY_PREVIEW_CONFIG} (found "${only}")`,
    );
  }
  return violations;
}
