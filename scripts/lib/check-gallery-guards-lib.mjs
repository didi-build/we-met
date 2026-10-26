import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseJsonc } from "./parse-jsonc.mjs";

const GALLERY_CONFIG = "wrangler.gallery.jsonc";
const GALLERY_WORKFLOW = ".github/workflows/gallery-preview.yml";

const BINDING_KEYS = [
  "d1_databases",
  "r2_buckets",
  "queues",
  "kv_namespaces",
  "services",
  "durable_objects",
  "hyperdrive",
  "vectorize",
  "dispatch_namespaces",
  "mtls_certificates",
  "send_email",
  "images",
  "browser",
  "ai",
  "analytics_engine_datasets",
  "pipelines",
  "secrets_store_secrets",
  "unsafe",
];

/**
 * @param {Record<string, unknown>} config
 * @returns {string[]}
 */
export function collectGalleryConfigViolations(config) {
  const errors = [];
  if (typeof config.main === "string" && config.main.length > 0) {
    errors.push(
      "wrangler.gallery.jsonc must not set main (preview-only static assets).",
    );
  }
  if (Array.isArray(config.routes) && config.routes.length > 0) {
    errors.push("wrangler.gallery.jsonc must not define routes.");
  }
  if (
    config.vars &&
    typeof config.vars === "object" &&
    Object.keys(config.vars).length > 0
  ) {
    errors.push("wrangler.gallery.jsonc must not define vars.");
  }
  for (const key of BINDING_KEYS) {
    const value = config[key];
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    if (typeof value === "object" && Object.keys(value).length === 0) {
      continue;
    }
    errors.push(`wrangler.gallery.jsonc must not define binding ${key}.`);
  }
  const previews = config.previews;
  if (previews === undefined) {
    errors.push("wrangler.gallery.jsonc must include an empty previews block.");
  } else if (
    typeof previews !== "object" ||
    previews === null ||
    Array.isArray(previews)
  ) {
    errors.push("wrangler.gallery.jsonc previews must be an object.");
  } else if (Object.keys(previews).length > 0) {
    errors.push(
      "wrangler.gallery.jsonc previews must be empty (no nested bindings or vars).",
    );
  }
  if (config.name !== "we-met") {
    errors.push(
      'wrangler.gallery.jsonc name must remain "we-met" (Worker-scoped preview token).',
    );
  }
  return errors;
}

/**
 * @param {string} workflowText
 * @returns {string[]}
 */
export function collectGalleryWorkflowViolations(workflowText) {
  const errors = [];
  if (!workflowText.includes("--ignore-base-config")) {
    errors.push(
      "gallery-preview.yml must pass --ignore-base-config to wrangler preview.",
    );
  }
  if (!/--worker-name\s+we-met/.test(workflowText)) {
    errors.push(
      "gallery-preview.yml must pass --worker-name we-met to wrangler preview.",
    );
  }
  if (!workflowText.includes("wrangler.gallery.jsonc")) {
    errors.push("gallery-preview.yml must use wrangler.gallery.jsonc.");
  }
  return errors;
}

const DEPLOY_PATTERNS = [
  /wrangler\s+deploy[^\n]*wrangler\.gallery\.jsonc/,
  /wrangler\s+deploy[^\n]*--config\s+wrangler\.gallery\.jsonc/,
  /wrangler\s+versions\s+deploy[^\n]*wrangler\.gallery\.jsonc/,
  /wrangler\s+versions\s+deploy[^\n]*--config\s+wrangler\.gallery\.jsonc/,
];

/**
 * @param {string} text
 * @param {string} label
 * @returns {string[]}
 */
export function collectGalleryDeployViolations(text, label) {
  const errors = [];
  for (const pattern of DEPLOY_PATTERNS) {
    if (pattern.test(text)) {
      errors.push(
        `${label} must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.`,
      );
      break;
    }
  }
  return errors;
}

function walkFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkFiles(full, files);
    } else if (/\.(yml|yaml|mjs|sh)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

/**
 * @param {string} repoRoot
 * @returns {string[]}
 */
export function runGalleryGuards(repoRoot = process.cwd()) {
  const errors = [];
  const configPath = join(repoRoot, GALLERY_CONFIG);
  const config = parseJsonc(readFileSync(configPath, "utf8"));
  errors.push(...collectGalleryConfigViolations(config));

  const workflowPath = join(repoRoot, GALLERY_WORKFLOW);
  const workflowText = readFileSync(workflowPath, "utf8");
  errors.push(...collectGalleryWorkflowViolations(workflowText));

  const scanRoots = [join(repoRoot, ".github"), join(repoRoot, "scripts")];
  for (const root of scanRoots) {
    for (const file of walkFiles(root)) {
      const rel = relative(repoRoot, file).replace(/\\/g, "/");
      if (rel === GALLERY_WORKFLOW.replace(/^\//, "")) {
        continue;
      }
      if (rel.includes("check-gallery-guards")) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      errors.push(...collectGalleryDeployViolations(text, rel));
    }
  }

  return errors;
}
