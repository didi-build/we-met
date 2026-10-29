import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { parse as parseYaml } from "yaml";

const STATIC_IMPORT_RE =
  /^\s*(?:import\s+(?:[\s\S]*?\sfrom\s+)?|export\s+(?:\*|[\s\S]*?\sfrom\s+))['"](\.\.?\/[^'"]+)['"]/gm;

const NODE_SCRIPT_RE = /\bnode\s+(\S+\.(?:mjs|cjs|js|ts))\b/g;
const TSX_SCRIPT_RE = /\bnpx\s+tsx\s+(\S+\.(?:ts|tsx|mjs))\b/g;
const NPM_RUN_RE = /\bnpm run\s+([a-z0-9:_-]+)/g;

/**
 * @param {string} packageJsonPath
 * @returns {Record<string, string>}
 */
export function readPackageScripts(packageJsonPath) {
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return pkg.scripts ?? {};
}

/**
 * @param {string} scriptName
 * @param {Record<string, string>} scripts
 * @param {Set<string>} [seen]
 * @returns {string[]}
 */
export function resolveNpmRunScriptEntrypoints(scriptName, scripts, seen = new Set()) {
  if (seen.has(scriptName)) {
    return [];
  }
  seen.add(scriptName);
  const cmd = scripts[scriptName];
  if (!cmd || typeof cmd !== "string") {
    return [];
  }
  /** @type {string[]} */
  const entries = [];
  for (const match of cmd.matchAll(NODE_SCRIPT_RE)) {
    entries.push(match[1]);
  }
  for (const match of cmd.matchAll(TSX_SCRIPT_RE)) {
    entries.push(match[1]);
  }
  for (const match of cmd.matchAll(NPM_RUN_RE)) {
    entries.push(...resolveNpmRunScriptEntrypoints(match[1], scripts, seen));
  }
  return entries;
}

/**
 * @param {string} runText
 * @param {Record<string, string>} scripts
 * @returns {string[]}
 */
export function extractRepoScriptEntrypointsFromRun(runText, scripts) {
  /** @type {string[]} */
  const entries = [];
  for (const match of runText.matchAll(NODE_SCRIPT_RE)) {
    entries.push(match[1]);
  }
  for (const match of runText.matchAll(TSX_SCRIPT_RE)) {
    entries.push(match[1]);
  }
  for (const match of runText.matchAll(NPM_RUN_RE)) {
    entries.push(...resolveNpmRunScriptEntrypoints(match[1], scripts));
  }
  return entries;
}

/**
 * @param {unknown} node
 * @param {string[]} runs
 */
function collectRunStringsFromWorkflowNode(node, runs) {
  if (node === null || node === undefined) {
    return;
  }
  if (typeof node === "string") {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectRunStringsFromWorkflowNode(item, runs);
    }
    return;
  }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "run" && typeof value === "string") {
        runs.push(value);
        continue;
      }
      collectRunStringsFromWorkflowNode(value, runs);
    }
  }
}

/**
 * @param {string} workflowsDir
 * @param {Record<string, string>} scripts
 * @returns {string[]}
 */
export function collectWorkflowScriptEntrypoints(workflowsDir, scripts) {
  /** @type {Set<string>} */
  const entries = new Set();
  for (const name of readdirSync(workflowsDir)) {
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) {
      continue;
    }
    const parsed = parseYaml(readFileSync(join(workflowsDir, name), "utf8"));
    /** @type {string[]} */
    const runs = [];
    collectRunStringsFromWorkflowNode(parsed, runs);
    for (const runText of runs) {
      for (const entry of extractRepoScriptEntrypointsFromRun(runText, scripts)) {
        entries.add(entry);
      }
    }
  }
  return [...entries].sort((a, b) => a.localeCompare(b));
}

/**
 * @param {string} fromAbs
 * @param {string} spec
 * @returns {string | null} absolute path
 */
export function resolveRelativeRepoImport(fromAbs, spec) {
  const base = resolve(dirname(fromAbs), spec);
  const extensions = ["", ".mjs", ".js", ".ts", ".tsx", ".json"];
  for (const ext of extensions) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const indexFile of ["index.mjs", "index.js", "index.ts"]) {
      const candidate = join(base, indexFile);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * Walk static relative imports transitively from a repo-relative entry file.
 * Dynamic import() with a non-literal argument is intentionally not followed (ADR 0005).
 *
 * @param {string} repoRoot
 * @param {string} entryRel
 * @param {Set<string>} visited repo-relative paths
 */
export function walkStaticImportsFromEntry(repoRoot, entryRel, visited) {
  const abs = resolve(repoRoot, entryRel);
  if (!existsSync(abs)) {
    return;
  }
  if (visited.has(entryRel)) {
    return;
  }
  visited.add(entryRel);
  if (!/\.(mjs|cjs|js|ts|tsx)$/.test(entryRel)) {
    return;
  }
  let content;
  try {
    content = readFileSync(abs, "utf8");
  } catch {
    return;
  }
  STATIC_IMPORT_RE.lastIndex = 0;
  for (const match of content.matchAll(STATIC_IMPORT_RE)) {
    const targetAbs = resolveRelativeRepoImport(abs, match[1]);
    if (!targetAbs || !targetAbs.startsWith(`${repoRoot}/`)) {
      continue;
    }
    const rel = targetAbs.slice(repoRoot.length + 1);
    walkStaticImportsFromEntry(repoRoot, rel, visited);
  }
}

/**
 * @param {{
 *   repoRoot?: string;
 *   workflowsDir?: string;
 *   packageJsonPath?: string;
 *   isPrivilegedPath: (filename: string) => boolean;
 *   extraEntrypoints?: string[];
 * }} options
 * @returns {{
 *   entrypoints: string[];
 *   reachable: string[];
 *   unlisted: string[];
 * }}
 */
export function analyzeWorkflowImportWalk(options) {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const workflowsDir = resolve(
    options.workflowsDir ?? join(repoRoot, ".github/workflows"),
  );
  const packageJsonPath = resolve(
    options.packageJsonPath ?? join(repoRoot, "package.json"),
  );
  const scripts = readPackageScripts(packageJsonPath);
  const entrypoints = collectWorkflowScriptEntrypoints(workflowsDir, scripts);
  for (const extra of options.extraEntrypoints ?? []) {
    if (!entrypoints.includes(extra)) {
      entrypoints.push(extra);
    }
  }
  entrypoints.sort((a, b) => a.localeCompare(b));

  /** @type {Set<string>} */
  const visited = new Set();
  for (const entry of entrypoints) {
    walkStaticImportsFromEntry(repoRoot, entry, visited);
  }
  const reachable = [...visited].sort((a, b) => a.localeCompare(b));
  const unlisted = reachable.filter((file) => !options.isPrivilegedPath(file));
  return { entrypoints, reachable, unlisted };
}
