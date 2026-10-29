/**
 * Transitive static import walk from GitHub Actions workflow script entrypoints.
 *
 * Accepted gaps (ADR 0005: CI guards are regression checks, not security boundaries):
 * - Dynamic import() when the module specifier is not a string literal.
 * - Node built-in modules (node:fs, etc.) and npm package specifiers.
 * - Shell tools (gh, git, wrangler, npx wrangler, etc.) and inline node -e / --eval scripts.
 * - Spawned commands whose script path is not a string literal in source (variables, non-literal template literals in spawn arrays, bash "$VAR", /bin/bash wrappers).
 * - Type-only imports erased at runtime (still parsed if written as value imports; type-only from is skipped when detectable).
 *
 * Unresolved relative repo imports and missing workflow entrypoint files fail closed (throw), naming the module.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import ts from "typescript";
import { parse as parseYaml } from "yaml";

/** @typedef {{ entrypoints: string[]; reachable: string[]; unlisted: string[] }} WalkResult */

export class WorkflowImportWalkError extends Error {
  /**
   * @param {string} message
   * @param {{ module?: string }} [details]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = "WorkflowImportWalkError";
    this.module = details.module;
  }
}

const REPO_SOURCE_EXT = /\.(mjs|cjs|js|ts|tsx|mts|cts|sh)$/;

const RESOLVE_EXTENSIONS = [
  "",
  ".mjs",
  ".cjs",
  ".js",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".json",
];

const INDEX_FILES = [
  "index.mjs",
  "index.cjs",
  "index.js",
  "index.ts",
  "index.tsx",
  "index.mts",
  "index.cts",
];

const TS_ALIAS_PREFIX = "@/";

const REPO_ROOT_PREFIX = "(?:scripts|test|src|workers|gallery)";

const CREATE_REQUIRE_THEN_CALL_RE =
  /createRequire\s*\([^)]*\)[\s\S]{0,500}?\b\w+\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;

const BASH_IN_QUOTED_ARRAY_STRING_RE =
  /["'](?:\/?(?:usr\/)?bin\/)?bash\s+((?:\.\.?\/|scripts\/|test\/|workers\/|gallery\/)[^\s'"]+)["']/g;

const NODE_ENTRY_RE = new RegExp(
  String.raw`\bnode(?:\s+(?:--[\w-]+(?:=\S+|(?:\s+[^\s]+)?)|-r\s+\S+))*\s+(?:['"](\.\.?\/[^'"]+|${REPO_ROOT_PREFIX}\/[^'"]+)['"]|(\.\.?\/[^\s'"]+|${REPO_ROOT_PREFIX}\/[^\s'"]+))`,
  "g",
);

const TSX_ENTRY_RE = new RegExp(
  String.raw`\bnpx\s+(?:--yes\s+)?tsx(?:@[\w.^/-]+)?\s+(?:['"](\.\.?\/[^'"]+|${REPO_ROOT_PREFIX}\/[^'"]+)['"]|(\.\.?\/[^\s'"]+|${REPO_ROOT_PREFIX}\/[^\s'"]+))`,
  "g",
);

const BARE_TSX_ENTRY_RE = new RegExp(
  String.raw`\btsx\s+(?:['"](\.\.?\/[^'"]+|${REPO_ROOT_PREFIX}\/[^'"]+)['"]|(\.\.?\/[^\s'"]+|${REPO_ROOT_PREFIX}\/[^\s'"]+))`,
  "g",
);

const NPM_EXEC_ENTRY_RE = new RegExp(
  String.raw`\bnpm\s+exec(?:\s+-[^\s]+)*\s+(?:--\s+)?(?:['"](\.\.?\/[^'"]+|${REPO_ROOT_PREFIX}\/[^'"]+)['"]|(\.\.?\/[^\s'"]+|${REPO_ROOT_PREFIX}\/[^\s'"]+))`,
  "g",
);

const NPM_RUN_EXPLICIT_RE =
  /\bnpm\s+run(?:-script)?(?:\s+-[^\s]+)*\s+([a-z0-9:_-]+)\b/g;

const NPM_TEST_RE = /\bnpm\s+test\b/g;

const SHELL_WRAPPER_RE =
  /\b(?:bash|sh)\s+(?:-[^\s]+\s+)*(-(?:lc|c)\s+)?(['"])([\s\S]*?)\2/g;

const BASH_SH_SCRIPT_FILE_RE =
  /\b(?:\/?(?:usr\/)?bin\/)?(?:bash|sh)\s+(?:-[^\s]+\s+)*['"]?((?:\.\.?\/|scripts\/|test\/|workers\/|gallery\/)[^\s'"]+)['"]?/g;

const BASH_SH_NONLITERAL_ARG_RE =
  /\b(?:\/?(?:usr\/)?bin\/)?(?:bash|sh)\s+(?:-[^\s]+\s+)*(\$[^\s/]+|"[^"]*\$[^"']*"|'[^']*\$[^']*')/g;

const EXEC_BASH_ONE_STRING_RE =
  /(?:execSync|exec)\s*\(\s*['"](?:\/?(?:usr\/)?bin\/)?(?:bash|sh)\s+((?:\.\.?\/|scripts\/|test\/|workers\/|gallery\/)[^\s'"]+)['"]/g;

const DIRECT_DOT_SLASH_SCRIPT_RUN_RE = new RegExp(
  String.raw`(?:^|\s)(['"]?(\.\/(?:${REPO_ROOT_PREFIX})\/[^\s'"]+)['"]?)`,
  "g",
);

const SPAWN_CHILD_PROCESS_RE = String.raw`(?:spawnSync|execFileSync|execSync|spawn|execFile|exec)`;

const SPAWN_NODE_ARRAY_RE = new RegExp(
  `${SPAWN_CHILD_PROCESS_RE}\\s*\\(\\s*(?:process\\.execPath|"node"|'node')\\s*,\\s*\\[([\\s\\S]*?)\\]`,
  "g",
);

const SPAWN_NPM_ARRAY_RE = new RegExp(
  `${SPAWN_CHILD_PROCESS_RE}\\s*\\(\\s*["']npm["']\\s*,\\s*\\[([\\s\\S]*?)\\]`,
  "g",
);

const SPAWN_PLAIN_NODE_RE = new RegExp(
  `${SPAWN_CHILD_PROCESS_RE}\\s*\\(\\s*["']node["']\\s*,\\s*\\[([\\s\\S]*?)\\]`,
  "g",
);

const SPAWN_BASH_ARRAY_RE = new RegExp(
  `${SPAWN_CHILD_PROCESS_RE}\\s*\\(\\s*["'](?:\\/?(?:usr\\/)?bin\\/)?bash["']\\s*,\\s*\\[([\\s\\S]*?)\\]`,
  "g",
);

const SPAWN_SH_ARRAY_RE = new RegExp(
  `${SPAWN_CHILD_PROCESS_RE}\\s*\\(\\s*["'](?:\\/?(?:usr\\/)?bin\\/)?sh["']\\s*,\\s*\\[([\\s\\S]*?)\\]`,
  "g",
);

const RUN_NPM_LITERAL_RE =
  /\brunNpm\s*\(\s*\[\s*["']run["']\s*,\s*["']([a-z0-9:_-]+)["']/g;

const ARRAY_STRING_LITERAL_RE = new RegExp(
  String.raw`["'](\.\.?\/[^"']+|${REPO_ROOT_PREFIX}\/[^"']+)["']`,
  "g",
);

/**
 * @param {string} relPath
 */
function scriptKindFromRelPath(relPath) {
  const lower = relPath.toLowerCase();
  if (lower.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (lower.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  if (lower.endsWith(".ts") || lower.endsWith(".mts") || lower.endsWith(".cts")) {
    return ts.ScriptKind.TS;
  }
  return ts.ScriptKind.JS;
}

/**
 * @param {string} content
 * @param {string} relPath
 */
function assertSourceParsesCleanly(content, relPath) {
  const fileName = relPath || "snippet.js";
  const kind = scriptKindFromRelPath(relPath);
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    const detail = sourceFile.parseDiagnostics[0];
    const message = ts.flattenDiagnosticMessageText(detail.messageText, " ");
    throw new WorkflowImportWalkError(
      `Source did not parse cleanly (${fileName}): ${message}`,
      { module: fileName },
    );
  }
}

/**
 * Remove comments with the TypeScript scanner; preserve strings, templates, and regex literals.
 * @param {string} content
 * @param {string} [relPath]
 */
export function stripJsComments(content, relPath = "snippet.js") {
  assertSourceParsesCleanly(content, relPath);
  const kind = scriptKindFromRelPath(relPath);
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, kind, content);
  /** @type {string[]} */
  const chunks = [];
  while (true) {
    const token = scanner.scan();
    const start = scanner.getTokenPos();
    const end = scanner.getTextPos();
    if (token === ts.SyntaxKind.EndOfFileToken) {
      break;
    }
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      chunks.push(" ".repeat(Math.max(0, end - start)));
    } else {
      chunks.push(content.slice(start, end));
    }
  }
  return chunks.join("");
}

/**
 * @param {string} token
 */
function assertNonLiteralShellPath(token, contextLabel) {
  if (/\$\{|\$[({\w]/.test(token)) {
    throw new WorkflowImportWalkError(
      `Non-literal spawn script path: ${token} (${contextLabel})`,
      { module: token },
    );
  }
}

/**
 * @param {string} packageJsonPath
 * @returns {Record<string, string>}
 */
export function readPackageScripts(packageJsonPath) {
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return pkg.scripts ?? {};
}

/**
 * @param {string} repoRoot
 * @returns {string | null}
 */
function readTsAliasPrefix(repoRoot) {
  const tsconfigPath = join(repoRoot, "tsconfig.json");
  if (!existsSync(tsconfigPath)) {
    return null;
  }
  try {
    const raw = readFileSync(tsconfigPath, "utf8");
    const match = raw.match(/"@\/\*"\s*:\s*\[\s*"\.\/([^"]+)\/\*"\s*\]/);
    if (!match) {
      return null;
    }
    return match[1].replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * @param {string} spec
 * @param {string | null} tsAliasRoot repo-relative directory (e.g. src)
 */
function isRepoRelativeSpecifier(spec, tsAliasRoot) {
  if (spec.startsWith("./") || spec.startsWith("../")) {
    return true;
  }
  if (
    spec.startsWith("scripts/") ||
    spec.startsWith("src/") ||
    spec.startsWith("test/") ||
    spec.startsWith("workers/") ||
    spec.startsWith("gallery/")
  ) {
    return true;
  }
  if (tsAliasRoot && spec.startsWith(TS_ALIAS_PREFIX)) {
    return true;
  }
  return false;
}

/**
 * @param {string} spec
 * @param {string | null} tsAliasRoot
 * @returns {string} repo-relative path without resolving to disk yet
 */
export function normalizeRepoRelativeSpecifier(spec, tsAliasRoot) {
  if (tsAliasRoot && spec.startsWith(TS_ALIAS_PREFIX)) {
    return join(tsAliasRoot, spec.slice(TS_ALIAS_PREFIX.length));
  }
  if (spec.startsWith("./") || spec.startsWith("../")) {
    return spec;
  }
  return spec;
}

/**
 * @param {string} token
 * @returns {string | null}
 */
function normalizeEntrypointToken(token) {
  let trimmed = token.trim().replace(/^['"]|['"]$/g, "");
  trimmed = trimmed.replace(/\s*[012]?>>?[^\s]*(?:\s+[^\s]+)?$/, "");
  trimmed = trimmed.replace(/[012]?>>[^\s'"]*(?:\s+[^\s]+)?$/, "");
  trimmed = trimmed.replace(/\s*>>?\s*["'][^"']*["']\s*$/, "");
  trimmed = trimmed.replace(/[);]+$/g, "");
  if (!trimmed || trimmed.startsWith("-")) {
    return null;
  }
  if (!REPO_SOURCE_EXT.test(trimmed) && !trimmed.includes("/")) {
    return null;
  }
  let rel = trimmed;
  if (rel.startsWith("./")) {
    rel = rel.slice(2);
  }
  return rel;
}

/**
 * @param {string} token
 * @param {string} contextLabel
 * @returns {string | null}
 */
function normalizeSpawnScriptToken(token, contextLabel) {
  const trimmed = token
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s*[012]?>>?[^\s]*(?:\s+[^\s]+)?$/, "")
    .replace(/[012]?>>[^\s'"]*(?:\s+[^\s]+)?$/, "")
    .replace(/\s*>>?\s*["'][^"']*["']\s*$/, "")
    .replace(/[);]+$/g, "");
  if (!trimmed || trimmed.startsWith("-")) {
    return null;
  }
  assertNonLiteralShellPath(trimmed, contextLabel);
  const rel = normalizeEntrypointToken(trimmed);
  return rel;
}

/**
 * @param {string} runText
 * @param {string} contextLabel
 */
function assertNonLiteralBashShRunArgs(runText, contextLabel) {
  BASH_SH_NONLITERAL_ARG_RE.lastIndex = 0;
  for (const match of runText.matchAll(BASH_SH_NONLITERAL_ARG_RE)) {
    let inner = (match[1] ?? "").trim();
    if (
      (inner.startsWith('"') && inner.endsWith('"')) ||
      (inner.startsWith("'") && inner.endsWith("'"))
    ) {
      inner = inner.slice(1, -1);
    }
    if (/\s/.test(inner)) {
      continue;
    }
    assertNonLiteralShellPath(inner, contextLabel);
  }
}

/**
 * @param {string} relPath
 */
function isJsLikeSourcePath(relPath) {
  return /\.(mjs|cjs|js|ts|tsx|mts|cts)$/.test(relPath);
}

/**
 * @param {string} block
 */
function assertNoTemplateLiteralsInSpawnArrayBlock(block) {
  if (/`/.test(block)) {
    throw new WorkflowImportWalkError(
      "Template literal in spawn array (spawn array literal)",
      { module: block.slice(0, 80) },
    );
  }
}

/**
 * @param {string} block
 * @param {Set<string>} entries
 */
function collectBashPathsFromSpawnArrayBlock(block, entries) {
  BASH_IN_QUOTED_ARRAY_STRING_RE.lastIndex = 0;
  for (const match of block.matchAll(BASH_IN_QUOTED_ARRAY_STRING_RE)) {
    const rel = normalizeSpawnScriptToken(match[1], "bash in spawn array string");
    if (rel) {
      entries.add(rel);
    }
  }
}

/**
 * @param {string} content
 * @param {string} relPath
 */
function collectSpawnScriptLiteralsFromSource(content, relPath) {
  if (!isJsLikeSourcePath(relPath)) {
    return new Set();
  }
  /** @type {Set<string>} */
  const entries = new Set();
  const stripped = stripJsComments(content, relPath);
  BASH_SH_SCRIPT_FILE_RE.lastIndex = 0;
  for (const match of stripped.matchAll(BASH_SH_SCRIPT_FILE_RE)) {
    const rel = normalizeSpawnScriptToken(match[1], "bash/sh spawn in source");
    if (rel) {
      entries.add(rel);
    }
  }
  EXEC_BASH_ONE_STRING_RE.lastIndex = 0;
  for (const match of stripped.matchAll(EXEC_BASH_ONE_STRING_RE)) {
    const rel = normalizeSpawnScriptToken(match[1], "execSync bash/sh string");
    if (rel) {
      entries.add(rel);
    }
  }
  return entries;
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
  return extractRepoScriptEntrypointsFromRun(cmd, scripts, seen);
}

/**
 * @param {string} runText
 * @param {Record<string, string>} scripts
 * @param {Set<string>} [seenNpm]
 * @returns {string[]}
 */
export function extractRepoScriptEntrypointsFromRun(
  runText,
  scripts,
  seenNpm = new Set(),
) {
  /** @type {Set<string>} */
  const entries = new Set();

  for (const match of runText.matchAll(NODE_ENTRY_RE)) {
    const raw = match[1] ?? match[2];
    const rel = normalizeEntrypointToken(raw);
    if (rel) {
      entries.add(rel);
    }
  }

  for (const match of runText.matchAll(TSX_ENTRY_RE)) {
    const raw = match[1] ?? match[2];
    const rel = normalizeEntrypointToken(raw);
    if (rel) {
      entries.add(rel);
    }
  }

  for (const match of runText.matchAll(BARE_TSX_ENTRY_RE)) {
    const raw = match[1] ?? match[2];
    const rel = normalizeEntrypointToken(raw);
    if (rel) {
      entries.add(rel);
    }
  }

  for (const match of runText.matchAll(NPM_EXEC_ENTRY_RE)) {
    const raw = match[1] ?? match[2];
    const rel = normalizeEntrypointToken(raw);
    if (rel) {
      entries.add(rel);
    }
  }

  if (NPM_TEST_RE.test(runText) && scripts.test) {
    for (const rel of resolveNpmRunScriptEntrypoints("test", scripts, seenNpm)) {
      entries.add(rel);
    }
  }

  for (const match of runText.matchAll(NPM_RUN_EXPLICIT_RE)) {
    for (const rel of resolveNpmRunScriptEntrypoints(match[1], scripts, seenNpm)) {
      entries.add(rel);
    }
  }

  for (const match of runText.matchAll(SHELL_WRAPPER_RE)) {
    const inner = match[3] ?? "";
    for (const rel of extractRepoScriptEntrypointsFromRun(inner, scripts, seenNpm)) {
      entries.add(rel);
    }
  }

  assertNonLiteralBashShRunArgs(runText, "bash/sh in workflow run");

  DIRECT_DOT_SLASH_SCRIPT_RUN_RE.lastIndex = 0;
  for (const match of runText.matchAll(DIRECT_DOT_SLASH_SCRIPT_RUN_RE)) {
    const raw = match[2] ?? match[1];
    const rel = normalizeEntrypointToken(raw);
    if (rel) {
      entries.add(rel);
    }
  }

  BASH_SH_SCRIPT_FILE_RE.lastIndex = 0;
  for (const match of runText.matchAll(BASH_SH_SCRIPT_FILE_RE)) {
    const rel = normalizeSpawnScriptToken(match[1], "bash/sh in workflow run");
    if (rel) {
      entries.add(rel);
    }
  }

  return [...entries];
}

/**
 * @param {string} content
 * @param {Record<string, string>} scripts
 * @param {string} relPath
 * @returns {string[]}
 */
export function extractSpawnedRepoScriptEntrypointsFromSource(
  content,
  scripts,
  relPath,
) {
  if (!isJsLikeSourcePath(relPath)) {
    return [];
  }
  /** @type {Set<string>} */
  const entries = new Set();
  const seenNpm = new Set();

  for (const re of [
    SPAWN_NODE_ARRAY_RE,
    SPAWN_PLAIN_NODE_RE,
    SPAWN_NPM_ARRAY_RE,
    SPAWN_BASH_ARRAY_RE,
    SPAWN_SH_ARRAY_RE,
  ]) {
    re.lastIndex = 0;
    for (const match of content.matchAll(re)) {
      const block = match[1];
      assertNoTemplateLiteralsInSpawnArrayBlock(block);
      if (re === SPAWN_BASH_ARRAY_RE || re === SPAWN_SH_ARRAY_RE) {
        const SPAWN_ARRAY_ANY_QUOTED_RE = /["']([^"']+)["']/g;
        for (const lit of block.matchAll(SPAWN_ARRAY_ANY_QUOTED_RE)) {
          assertNonLiteralShellPath(lit[1], "spawn array literal");
        }
        collectBashPathsFromSpawnArrayBlock(block, entries);
      }
      ARRAY_STRING_LITERAL_RE.lastIndex = 0;
      for (const lit of block.matchAll(ARRAY_STRING_LITERAL_RE)) {
        const rel = normalizeSpawnScriptToken(lit[1], "spawn array literal");
        if (rel) {
          entries.add(rel);
        }
      }
      if (re === SPAWN_NPM_ARRAY_RE) {
        const runMatch = /["']run["']\s*,\s*["']([a-z0-9:_-]+)["']/.exec(block);
        if (runMatch) {
          for (const rel of resolveNpmRunScriptEntrypoints(
            runMatch[1],
            scripts,
            seenNpm,
          )) {
            entries.add(rel);
          }
        }
      }
    }
  }

  RUN_NPM_LITERAL_RE.lastIndex = 0;
  for (const match of content.matchAll(RUN_NPM_LITERAL_RE)) {
    for (const rel of resolveNpmRunScriptEntrypoints(match[1], scripts, seenNpm)) {
      entries.add(rel);
    }
  }

  for (const rel of collectSpawnScriptLiteralsFromSource(content, relPath)) {
    entries.add(rel);
  }

  return [...entries];
}

/**
 * @param {string} repoRoot
 * @param {string[]} seedEntrypoints
 * @param {Record<string, string>} scripts
 * @param {string | null} tsAliasRoot
 * @returns {{ entrypoints: string[]; reachable: string[] }}
 */
export function walkReachableWithImportsAndSpawns(
  repoRoot,
  seedEntrypoints,
  scripts,
  tsAliasRoot,
) {
  /** @type {Set<string>} */
  const reachable = new Set();
  /** @type {Set<string>} */
  const entrypoints = new Set(seedEntrypoints);
  /** @type {string[]} */
  const queue = [...seedEntrypoints];

  while (queue.length > 0) {
    const rel = queue.pop();
    if (!rel || reachable.has(rel)) {
      continue;
    }
    reachable.add(rel);
    assertEntrypointExists(repoRoot, rel);

    if (!REPO_SOURCE_EXT.test(rel)) {
      continue;
    }

    const abs = resolve(repoRoot, rel);
    const content = readFileSync(abs, "utf8");

    for (const spawned of extractSpawnedRepoScriptEntrypointsFromSource(
      content,
      scripts,
      rel,
    )) {
      assertEntrypointExists(repoRoot, spawned);
      entrypoints.add(spawned);
      if (!reachable.has(spawned)) {
        queue.push(spawned);
      }
    }

    if (isJsLikeSourcePath(rel)) {
      for (const spec of collectStaticModuleSpecifiers(content, rel)) {
        if (!isRepoRelativeSpecifier(spec, tsAliasRoot)) {
          continue;
        }
        const importRel = resolveRepoModuleOrThrow(repoRoot, abs, spec, tsAliasRoot);
        if (!reachable.has(importRel)) {
          queue.push(importRel);
        }
      }
    }
  }

  return {
    entrypoints: [...entrypoints].sort((a, b) => a.localeCompare(b)),
    reachable: [...reachable].sort((a, b) => a.localeCompare(b)),
  };
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
 * @param {string} repoRoot
 * @param {string} relEntry
 */
export function assertEntrypointExists(repoRoot, relEntry) {
  const abs = resolve(repoRoot, relEntry);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    throw new WorkflowImportWalkError(
      `Missing workflow entrypoint module: ${relEntry}`,
      {
        module: relEntry,
      },
    );
  }
}

/**
 * @param {string} repoRoot
 * @param {string} fromAbs
 * @param {string} spec repo-relative or relative specifier
 * @param {string | null} tsAliasRoot
 * @returns {string | null} absolute path
 */
export function resolveRelativeRepoImport(repoRoot, fromAbs, spec, tsAliasRoot = null) {
  const normalized = normalizeRepoRelativeSpecifier(spec, tsAliasRoot);
  const base =
    normalized.startsWith("./") || normalized.startsWith("../")
      ? resolve(dirname(fromAbs), normalized)
      : join(repoRoot, normalized);
  return resolveRepoImportPath(base);
}

/**
 * @param {string} basePath absolute path without requiring extension
 * @returns {string | null}
 */
function resolveRepoImportPath(basePath) {
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = basePath + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  if (basePath.endsWith(".js")) {
    const asTs = basePath.slice(0, -3) + ".ts";
    if (existsSync(asTs) && statSync(asTs).isFile()) {
      return asTs;
    }
    const asTsx = basePath.slice(0, -3) + ".tsx";
    if (existsSync(asTsx) && statSync(asTsx).isFile()) {
      return asTsx;
    }
  }

  if (existsSync(basePath) && statSync(basePath).isDirectory()) {
    for (const indexFile of INDEX_FILES) {
      const candidate = join(basePath, indexFile);
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * @param {string} repoRoot
 * @param {string} fromAbs
 * @param {string} spec
 * @param {string | null} tsAliasRoot
 * @returns {string} repo-relative resolved path
 */
export function resolveRepoModuleOrThrow(repoRoot, fromAbs, spec, tsAliasRoot) {
  if (!isRepoRelativeSpecifier(spec, tsAliasRoot)) {
    throw new WorkflowImportWalkError(
      `Unsupported module specifier (not a repo-relative path or ${TS_ALIAS_PREFIX} alias): ${spec}`,
      { module: spec },
    );
  }

  const fromRel = relative(repoRoot, fromAbs);
  const targetAbs = resolveRelativeRepoImport(repoRoot, fromAbs, spec, tsAliasRoot);
  const relToRoot = targetAbs ? relative(repoRoot, targetAbs) : "..";
  if (!targetAbs || relToRoot.startsWith("..") || relToRoot === "") {
    throw new WorkflowImportWalkError(
      `Unresolved static import: ${spec} (from ${fromRel})`,
      { module: spec },
    );
  }
  return relative(repoRoot, targetAbs);
}

/**
 * @param {string} content
 * @param {string} [relPath]
 * @returns {string[]}
 */
export function collectStaticModuleSpecifiers(content, relPath = "snippet.js") {
  /** @type {Set<string>} */
  const specs = new Set();
  assertSourceParsesCleanly(content, relPath);

  let preprocessed;
  try {
    preprocessed = ts.preProcessFile(content, true, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new WorkflowImportWalkError(
      `preProcessFile failed (${relPath}): ${message}`,
      { module: relPath },
    );
  }

  for (const imported of preprocessed.importedFiles) {
    if (imported.fileName) {
      specs.add(imported.fileName);
    }
  }

  const stripped = stripJsComments(content, relPath);
  CREATE_REQUIRE_THEN_CALL_RE.lastIndex = 0;
  for (const match of stripped.matchAll(CREATE_REQUIRE_THEN_CALL_RE)) {
    specs.add(match[1]);
  }

  return [...specs];
}

/**
 * @param {string} repoRoot
 * @param {string} entryRel
 * @param {Set<string>} visited
 * @param {string | null} tsAliasRoot
 */
export function walkStaticImportsFromEntry(repoRoot, entryRel, visited, tsAliasRoot) {
  assertEntrypointExists(repoRoot, entryRel);
  if (visited.has(entryRel)) {
    return;
  }
  visited.add(entryRel);
  if (!REPO_SOURCE_EXT.test(entryRel)) {
    return;
  }
  if (entryRel.endsWith(".sh")) {
    return;
  }
  const abs = resolve(repoRoot, entryRel);
  const content = readFileSync(abs, "utf8");
  for (const spec of collectStaticModuleSpecifiers(content, entryRel)) {
    if (!isRepoRelativeSpecifier(spec, tsAliasRoot)) {
      continue;
    }
    const rel = resolveRepoModuleOrThrow(repoRoot, abs, spec, tsAliasRoot);
    walkStaticImportsFromEntry(repoRoot, rel, visited, tsAliasRoot);
  }
}

/**
 * @param {{
 *   repoRoot?: string;
 *   workflowsDir?: string;
 *   packageJsonPath?: string;
 *   isPrivilegedPath: (filename: string) => boolean;
 *   extraEntrypoints?: string[];
 *   skipSpawnExpansion?: boolean;
 * }} options
 * @returns {WalkResult}
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
  const tsAliasRoot = readTsAliasPrefix(repoRoot);

  let entrypoints = collectWorkflowScriptEntrypoints(workflowsDir, scripts);
  for (const extra of options.extraEntrypoints ?? []) {
    if (!entrypoints.includes(extra)) {
      entrypoints.push(extra);
    }
  }

  if (!options.skipSpawnExpansion) {
    const walked = walkReachableWithImportsAndSpawns(
      repoRoot,
      entrypoints,
      scripts,
      tsAliasRoot,
    );
    entrypoints = walked.entrypoints;
    const reachable = walked.reachable;
    const unlisted = reachable.filter((file) => !options.isPrivilegedPath(file));
    return { entrypoints, reachable, unlisted };
  }

  for (const entry of entrypoints) {
    assertEntrypointExists(repoRoot, entry);
  }

  /** @type {Set<string>} */
  const visited = new Set();
  for (const entry of entrypoints) {
    walkStaticImportsFromEntry(repoRoot, entry, visited, tsAliasRoot);
  }
  const reachable = [...visited].sort((a, b) => a.localeCompare(b));
  const unlisted = reachable.filter((file) => !options.isPrivilegedPath(file));
  return { entrypoints, reachable, unlisted };
}
