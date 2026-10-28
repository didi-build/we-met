import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseJsonc } from "./parse-jsonc.mjs";

const GALLERY_CONFIG = "wrangler.gallery.jsonc";
const GALLERY_WORKFLOW = ".github/workflows/gallery-preview.yml";

const GUARD_SOURCE_PATHS = new Set([
  "scripts/check-gallery-guards.mjs",
  "scripts/lib/check-gallery-guards-lib.mjs",
]);

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "$schema",
  "name",
  "workers_dev",
  "preview_urls",
  "compatibility_date",
  "assets",
  "observability",
  "previews",
]);

const ALLOWED_ASSET_KEYS = new Set(["directory", "not_found_handling"]);

/**
 * @param {string} text
 * @returns {string}
 */
export function flattenYamlRunBlocks(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const pipeRun = line.match(/^(\s+)run:\s*\|\s*$/);
    if (pipeRun) {
      const baseIndent = pipeRun[1].length;
      const parts = [];
      i += 1;
      while (i < lines.length) {
        const bodyLine = lines[i];
        if (bodyLine.trim() === "") {
          i += 1;
          continue;
        }
        const bodyIndent = bodyLine.match(/^(\s*)/)?.[1].length ?? 0;
        if (bodyIndent <= baseIndent) {
          break;
        }
        parts.push(bodyLine.trim());
        i += 1;
      }
      out.push(`${pipeRun[1]}run: ${joinShellContinuations(parts.join("\n"))}`);
      continue;
    }
    out.push(line);
    i += 1;
  }
  return out.join("\n");
}

/**
 * Join shell line continuations (`\` at end of line) so deploy/preview scans see one line.
 * @param {string} text
 * @returns {string}
 */
export function joinShellContinuations(text) {
  const lines = text.split(/\r?\n/);
  const merged = [];
  let buffer = "";
  for (const line of lines) {
    const trimmed = line.replace(/\s+$/, "");
    if (trimmed.endsWith("\\")) {
      buffer += `${trimmed.slice(0, -1).trimEnd()} `;
      continue;
    }
    buffer += line;
    merged.push(buffer);
    buffer = "";
  }
  if (buffer.length > 0) {
    merged.push(buffer);
  }
  return merged.join("\n");
}

/**
 * @param {string} text
 * @param {{ isYaml?: boolean }} [options]
 * @returns {string}
 */
export function normalizeForDeployScan(text, options = {}) {
  let normalized = options.isYaml ? flattenYamlRunBlocks(text) : text;
  normalized = joinShellContinuations(normalized);
  return normalized.replace(/\r?\n/g, " ");
}

/**
 * @param {string[]} tokens
 * @param {number} start
 * @returns {number}
 */
function skipWranglerGlobalFlags(tokens, start) {
  const booleanFlags = new Set(["--dry-run", "--experimental-json-config"]);
  let i = start;
  while (i < tokens.length) {
    const token = tokens[i];
    if (!token.startsWith("-")) {
      break;
    }
    if (booleanFlags.has(token)) {
      i += 1;
      continue;
    }
    const next = tokens[i + 1];
    if (next !== undefined && !next.startsWith("-")) {
      i += 2;
    } else {
      i += 1;
    }
  }
  return i;
}

/**
 * @param {string} normalized
 * @returns {string[]}
 */
export function extractWranglerDeploySegments(normalized) {
  const segments = [];
  const re = /\bwrangler(?:@\S+)?\b/g;
  let match = re.exec(normalized);
  while (match) {
    const after = normalized.slice(match.index + match[0].length);
    const tokens = tokenizeShellArgs(after);
    const subIdx = skipWranglerGlobalFlags(tokens, 0);
    const sub = tokens[subIdx];
    if (sub === "versions" && tokens[subIdx + 1] === "deploy") {
      const end = subIdx + 2;
      let j = end;
      while (j < tokens.length && ![";", "&&", "||", "|"].includes(tokens[j])) {
        j += 1;
      }
      segments.push(["wrangler", ...tokens.slice(0, j)].join(" "));
    } else if (sub === "deploy") {
      const end = subIdx + 1;
      let j = end;
      while (j < tokens.length && ![";", "&&", "||", "|"].includes(tokens[j])) {
        j += 1;
      }
      segments.push(["wrangler", ...tokens.slice(0, j)].join(" "));
    }
    match = re.exec(normalized);
  }
  return segments;
}

/**
 * @param {string} segment
 * @returns {boolean}
 */
function referencesGalleryWranglerConfig(segment) {
  return (
    segment.includes("wrangler.gallery.jsonc") ||
    /--config\s+wrangler\.gallery\.jsonc/.test(segment) ||
    /-c\s+wrangler\.gallery\.jsonc/.test(segment)
  );
}

/**
 * Best-effort: spawnSync / execFile( Sync)? with a wrangler + deploy argv array and gallery config.
 * @param {string} text
 * @returns {boolean}
 */
export function detectArrayFormGalleryDeploy(text) {
  const callRe = /(?:spawnSync|execFileSync|execFile)\s*\(/g;
  let callMatch = callRe.exec(text);
  while (callMatch) {
    const slice = text.slice(callMatch.index, callMatch.index + 4000);
    const arrayMatch = slice.match(/\[[^\]]*\]/);
    if (arrayMatch) {
      const block = arrayMatch[0];
      if (
        /['"]wrangler(?:@\S+)?['"]/.test(block) &&
        /['"]deploy['"]/.test(block) &&
        /wrangler\.gallery\.jsonc/.test(block)
      ) {
        return true;
      }
    }
    callMatch = callRe.exec(text);
  }
  return false;
}

/**
 * @param {string} argString
 * @returns {boolean}
 */
function previewArgStringReferencesGalleryConfig(argString) {
  const { flags } = parsePreviewArgv(tokenizeShellArgs(argString));
  if (flags.get("--config") === "wrangler.gallery.jsonc") {
    return true;
  }
  if (flags.get("-c") === "wrangler.gallery.jsonc") {
    return true;
  }
  return /\bwrangler\.gallery\.jsonc\b/.test(argString);
}

/**
 * @param {string} text
 * @param {string} label
 * @param {{ isGalleryWorkflow?: boolean, isYaml?: boolean }} [options]
 * @returns {string[]}
 */
export function collectGalleryPreviewLocationViolations(text, label, options = {}) {
  if (options.isGalleryWorkflow || label === GALLERY_WORKFLOW) {
    return [];
  }
  const normalized = normalizeForDeployScan(text, {
    isYaml: options.isYaml ?? (label.endsWith(".yml") || label.endsWith(".yaml")),
  });
  const argStrings = extractWranglerPreviewArgStrings(normalized);
  for (const argString of argStrings) {
    if (previewArgStringReferencesGalleryConfig(argString)) {
      return [
        `${label} must not run wrangler preview with wrangler.gallery.jsonc (only ${GALLERY_WORKFLOW}).`,
      ];
    }
  }
  return [];
}

/**
 * @param {string} s
 * @returns {string[]}
 */
export function tokenizeShellArgs(s) {
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      let token = "";
      while (i < s.length && s[i] !== quote) {
        if (s[i] === "\\" && i + 1 < s.length) {
          token += s[i + 1];
          i += 2;
        } else {
          token += s[i];
          i += 1;
        }
      }
      if (s[i] === quote) {
        i += 1;
      }
      tokens.push(token);
      continue;
    }
    let token = "";
    while (i < s.length && !/\s/.test(s[i])) {
      token += s[i];
      i += 1;
    }
    tokens.push(token);
  }
  return tokens;
}

/**
 * @param {string} normalizedWorkflow
 * @returns {string[]}
 */
function extractWranglerPreviewArgStrings(normalizedWorkflow) {
  const argStrings = [];
  const re = /\b(?:npx\s+)?wrangler(?:@\S+)?\s+preview\b/g;
  let match = re.exec(normalizedWorkflow);
  while (match) {
    const rest = normalizedWorkflow.slice(match.index + match[0].length);
    const end = rest.search(/\s2>&1\b/);
    let slice = end === -1 ? rest : rest.slice(0, end);
    slice = slice.trim().replace(/[")]+$/, "");
    argStrings.push(slice.trim());
    match = re.exec(normalizedWorkflow);
  }
  return argStrings;
}

/**
 * @param {string[]} tokens
 * @returns {{ flags: Map<string, string | true>, positionals: string[] }}
 */
const ALLOWED_PREVIEW_FLAGS = new Set([
  "--config",
  "--worker-name",
  "--ignore-base-config",
  "--name",
  "--json",
]);

function parsePreviewArgv(tokens) {
  const flags = new Map();
  const positionals = [];
  const booleanFlags = new Set(["--ignore-base-config", "--json"]);
  for (let i = 0; i < tokens.length; i += 1) {
    let token = tokens[i];
    if (!token.startsWith("-")) {
      positionals.push(token);
      continue;
    }
    let flag = token;
    let valueFromEquals;
    const eqIdx = token.indexOf("=");
    if (eqIdx > 0 && token.startsWith("--")) {
      flag = token.slice(0, eqIdx);
      valueFromEquals = token.slice(eqIdx + 1);
    }
    if (booleanFlags.has(flag)) {
      flags.set(flag, true);
      continue;
    }
    if (valueFromEquals !== undefined) {
      flags.set(flag, valueFromEquals);
      continue;
    }
    const next = tokens[i + 1];
    if (next !== undefined && !next.startsWith("-")) {
      flags.set(flag, next);
      i += 1;
    } else {
      flags.set(flag, true);
    }
  }
  return { flags, positionals };
}

/**
 * @param {string} argString
 * @returns {string[]}
 */
export function collectGalleryPreviewArgvViolations(argString) {
  const errors = [];
  const { flags, positionals } = parsePreviewArgv(tokenizeShellArgs(argString));

  if (positionals.length > 0) {
    errors.push(
      "gallery-preview.yml wrangler preview must not pass a positional Worker script.",
    );
  }

  for (const flag of flags.keys()) {
    if (!ALLOWED_PREVIEW_FLAGS.has(flag)) {
      errors.push(`gallery-preview.yml wrangler preview must not pass ${flag}.`);
    }
  }

  if (flags.get("--config") !== "wrangler.gallery.jsonc") {
    errors.push(
      "gallery-preview.yml wrangler preview must pass --config wrangler.gallery.jsonc.",
    );
  }
  if (flags.get("--worker-name") !== "we-met") {
    errors.push("gallery-preview.yml wrangler preview must pass --worker-name we-met.");
  }
  if (!flags.has("--ignore-base-config")) {
    errors.push("gallery-preview.yml wrangler preview must pass --ignore-base-config.");
  }
  if (!flags.has("--name")) {
    errors.push("gallery-preview.yml wrangler preview must pass --name.");
  }
  if (!flags.has("--json")) {
    errors.push("gallery-preview.yml wrangler preview must pass --json.");
  }

  return errors;
}

/**
 * @param {Record<string, unknown>} config
 * @returns {string[]}
 */
export function collectGalleryConfigViolations(config) {
  const errors = [];
  for (const key of Object.keys(config)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      errors.push(`wrangler.gallery.jsonc must not define top-level key ${key}.`);
    }
  }
  if (config.workers_dev !== false) {
    errors.push("wrangler.gallery.jsonc must set workers_dev to false.");
  }
  if (config.name !== "we-met") {
    errors.push(
      'wrangler.gallery.jsonc name must remain "we-met" (Worker-scoped preview token).',
    );
  }
  const assets = config.assets;
  if (!assets || typeof assets !== "object" || Array.isArray(assets)) {
    errors.push("wrangler.gallery.jsonc must define an assets block.");
  } else {
    for (const key of Object.keys(assets)) {
      if (!ALLOWED_ASSET_KEYS.has(key)) {
        errors.push(`wrangler.gallery.jsonc assets must not define ${key}.`);
      }
    }
    if (assets.directory !== "./dist") {
      errors.push('wrangler.gallery.jsonc assets.directory must be "./dist".');
    }
    if (assets.binding !== undefined) {
      errors.push("wrangler.gallery.jsonc assets must not define binding.");
    }
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
  return errors;
}

/**
 * @param {string} workflowText
 * @returns {string[]}
 */
export function collectGalleryWorkflowViolations(workflowText) {
  const errors = [];
  const normalized = normalizeForDeployScan(workflowText, { isYaml: true });
  const argStrings = extractWranglerPreviewArgStrings(normalized);
  if (argStrings.length === 0) {
    errors.push("gallery-preview.yml must invoke wrangler preview.");
    return errors;
  }
  for (const argString of argStrings) {
    errors.push(...collectGalleryPreviewArgvViolations(argString));
  }
  return errors;
}

/**
 * @param {string} text
 * @param {string} label
 * @param {{ isGalleryWorkflow?: boolean, isYaml?: boolean }} [options]
 * @returns {string[]}
 */
export function collectGalleryDeployViolations(text, label, options = {}) {
  const errors = [];
  if (options.isGalleryWorkflow) {
    const normalizedWorkflow = normalizeForDeployScan(text, {
      isYaml: options.isYaml ?? true,
    });
    const segments = extractWranglerDeploySegments(normalizedWorkflow);
    if (segments.length > 0) {
      errors.push(`${label} must not run wrangler deploy or wrangler versions deploy.`);
    }
    if (detectArrayFormGalleryDeploy(text)) {
      errors.push(`${label} must not run wrangler deploy or wrangler versions deploy.`);
    }
    return errors;
  }
  if (detectArrayFormGalleryDeploy(text)) {
    errors.push(
      `${label} must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.`,
    );
    return errors;
  }
  const normalized = normalizeForDeployScan(text, {
    isYaml: options.isYaml ?? (label.endsWith(".yml") || label.endsWith(".yaml")),
  });
  const segments = extractWranglerDeploySegments(normalized);
  if (segments.length === 0) {
    return errors;
  }
  for (const segment of segments) {
    if (referencesGalleryWranglerConfig(segment)) {
      errors.push(
        `${label} must not run wrangler deploy/versions deploy with wrangler.gallery.jsonc.`,
      );
      return errors;
    }
  }
  return errors;
}

const SCANNED_FILE_RE = /\.(yml|yaml|mjs|js|cjs|ts|mts|sh)$/;

function walkFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkFiles(full, files);
    } else if (SCANNED_FILE_RE.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

/**
 * @param {string} repoRoot
 * @returns {string[]}
 */
function listRepoRootScanFiles(repoRoot) {
  const files = [];
  for (const entry of readdirSync(repoRoot)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") {
      continue;
    }
    const full = join(repoRoot, entry);
    if (!statSync(full).isFile()) {
      continue;
    }
    if (SCANNED_FILE_RE.test(entry)) {
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

  const workflowRel = GALLERY_WORKFLOW;
  const workflowPath = join(repoRoot, workflowRel);
  const workflowText = readFileSync(workflowPath, "utf8");
  errors.push(...collectGalleryWorkflowViolations(workflowText));
  errors.push(
    ...collectGalleryDeployViolations(workflowText, workflowRel, {
      isGalleryWorkflow: true,
      isYaml: true,
    }),
  );

  const pkgPath = join(repoRoot, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  for (const [scriptName, scriptBody] of Object.entries(pkg.scripts ?? {})) {
    if (typeof scriptBody !== "string") {
      continue;
    }
    errors.push(
      ...collectGalleryDeployViolations(
        scriptBody,
        `package.json scripts.${scriptName}`,
      ),
    );
    errors.push(
      ...collectGalleryPreviewLocationViolations(
        scriptBody,
        `package.json scripts.${scriptName}`,
      ),
    );
  }

  const filesToScan = new Set();
  for (const root of [
    join(repoRoot, ".github"),
    join(repoRoot, "scripts"),
    join(repoRoot, "workers"),
  ]) {
    for (const file of walkFiles(root)) {
      filesToScan.add(file);
    }
  }
  for (const file of listRepoRootScanFiles(repoRoot)) {
    filesToScan.add(file);
  }

  for (const file of filesToScan) {
    const rel = relative(repoRoot, file).replace(/\\/g, "/");
    if (GUARD_SOURCE_PATHS.has(rel)) {
      continue;
    }
    const text = readFileSync(file, "utf8");
    errors.push(...collectGalleryDeployViolations(text, rel));
    errors.push(...collectGalleryPreviewLocationViolations(text, rel));
  }

  return errors;
}
