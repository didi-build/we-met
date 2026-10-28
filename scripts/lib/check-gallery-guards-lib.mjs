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
    const pipeRun = line.match(/^(\s+)run:\s*[|>]-?\s*$/);
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

const WRANGLER_BINARY = String.raw`wrangler(?:@\S+)?`;

const WRANGLER_BIN_RE = new RegExp(
  `(?:(?:npx|npm\\s+exec|bunx|pnpm\\s+(?:exec|dlx)|yarn)\\s+|(?:[\\w.~-]+/)+|^|[\\s;(;&|])(?:["']?${WRANGLER_BINARY}["']?)(?=[\\s);,]|$|["'])`,
  "gi",
);

/**
 * @param {string} text
 * @returns {string[]}
 */
export function splitShellStatements(text) {
  return text
    .split(/\s*(?:;|&&|\|\|)\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function extractJsStringLiteralBodies(source) {
  const bodies = [];
  const patterns = [
    /"(?:\\.|[^"\\])*"/g,
    /'(?:\\.|[^'\\])*'/g,
    /`(?:\\.|[^`\\]|\\$\{(?:\\.|[^}\\])*\})*`/g,
  ];
  for (const pattern of patterns) {
    let match = pattern.exec(source);
    while (match) {
      bodies.push(match[0].slice(1, -1));
      match = pattern.exec(source);
    }
  }
  return bodies;
}

/**
 * @param {string} segment
 * @param {"deploy" | "preview"} subcommand
 * @returns {boolean}
 */
export function failClosedSegmentHasWranglerSubcommand(segment, subcommand) {
  const statements = splitShellStatements(
    joinShellContinuations(segment).replace(/\r?\n/g, " "),
  );
  const invocationRe = new RegExp(WRANGLER_BIN_RE.source, WRANGLER_BIN_RE.flags);
  for (const stmt of statements) {
    let match = invocationRe.exec(stmt);
    while (match) {
      const after = stmt.slice(match.index + match[0].length);
      if (subcommand === "deploy") {
        if (/\bversions\s+deploy\b/.test(after) || /\bdeploy\b/.test(after)) {
          return true;
        }
      } else if (/\bpreview\b/.test(after) || /pre''view/.test(after)) {
        return true;
      }
      match = invocationRe.exec(stmt);
    }
  }
  return false;
}

/**
 * @param {string} label
 * @returns {boolean}
 */
export function isJsSourceFile(label) {
  return /\.(mjs|js|cjs|ts|mts)(?:$|[\s:])/.test(label);
}

/**
 * @param {string} text
 * @param {{ isYaml?: boolean, isJs?: boolean }} [options]
 * @returns {string[]}
 */
export function scanSegments(text, options = {}) {
  const segments = [];
  if (options.isYaml) {
    for (const command of extractYamlRunCommands(text)) {
      segments.push(joinShellContinuations(command).replace(/\r?\n/g, " "));
      for (const line of command.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          segments.push(trimmed);
        }
      }
    }
    if (segments.length === 0) {
      segments.push(normalizeForDeployScan(text, { isYaml: true }));
    }
    return segments;
  }
  if (options.isJs) {
    for (const body of extractJsStringLiteralBodies(text)) {
      segments.push(body);
    }
  }
  segments.push(joinShellContinuations(text).replace(/\r?\n/g, " "));
  return segments;
}

/**
 * @param {string} yamlText
 * @returns {string[]}
 */
export function extractYamlRunCommands(yamlText) {
  const flattened = flattenYamlRunBlocks(yamlText);
  const commands = [];
  const lines = flattened.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const inline =
      lines[i].match(/-\s*run:\s*(.+)$/) ?? lines[i].match(/^\s+run:\s*(.+)$/);
    if (!inline) {
      continue;
    }
    const parts = [inline[1]];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (/^\s*-\s*name:/.test(next) || /^\s*-\s*uses:/.test(next)) {
        break;
      }
      if (/^\s{0,8}[a-zA-Z][a-zA-Z0-9_-]*:/.test(next)) {
        break;
      }
      if (next.trim() === "") {
        j += 1;
        continue;
      }
      parts.push(next.trim());
      j += 1;
    }
    commands.push(joinShellContinuations(parts.join("\n")));
    i = j - 1;
  }
  return commands;
}

/**
 * @param {string} text
 * @param {string} label
 * @param {{ isYaml?: boolean }} [options]
 * @returns {string[]}
 */
function normalizedScanSegments(text, label, options = {}) {
  const isYaml = options.isYaml ?? (label.endsWith(".yml") || label.endsWith(".yaml"));
  const isJs = isJsSourceFile(label) && !isYaml;
  return scanSegments(text, { isYaml, isJs });
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

const WRANGLER_GLOBAL_VALUE_FLAGS = new Set([
  "-c",
  "--config",
  "--cwd",
  "-e",
  "--env",
  "--env-file",
  "--profile",
]);

const WRANGLER_GLOBAL_BOOLEAN_FLAGS = new Set([
  "--dry-run",
  "--experimental-json-config",
]);

/**
 * @param {string} token
 * @returns {string}
 */
function cleanShellToken(token) {
  return token.replace(/(?:["']|[);,])+$/g, "");
}

/**
 * @param {string} token
 * @returns {string}
 */
export function normalizeShellWord(token) {
  return cleanShellToken(token).replace(/\\(.)/g, "$1").replace(/['"]/g, "");
}

/**
 * @param {string[]} tokens
 * @param {number} i
 * @returns {boolean}
 */
function tokenIsPreviewSubcommand(tokens, i) {
  if (normalizeShellWord(tokens[i] ?? "") === "preview") {
    return true;
  }
  if (i + 1 < tokens.length) {
    const merged = normalizeShellWord(tokens[i]) + normalizeShellWord(tokens[i + 1]);
    if (merged === "preview") {
      return true;
    }
  }
  return false;
}

/**
 * @param {string[]} tokens
 * @param {number} i
 * @returns {number}
 */
function advancePastWranglerGlobalFlag(tokens, i) {
  const token = tokens[i];
  if (!token.startsWith("-")) {
    return i;
  }
  if (token.includes("=")) {
    return i + 1;
  }
  if (WRANGLER_GLOBAL_BOOLEAN_FLAGS.has(token)) {
    return i + 1;
  }
  if (WRANGLER_GLOBAL_VALUE_FLAGS.has(token)) {
    const next = tokens[i + 1];
    if (next !== undefined && !next.startsWith("-")) {
      return i + 2;
    }
    return i + 1;
  }
  return i + 1;
}

/**
 * @param {string[]} tokens
 * @param {number} [start]
 * @returns {{ index: number, unknownGlobals: string[], previewSpan: number }}
 */
export function findWranglerPreviewSubcommand(tokens, start = 0) {
  const unknownGlobals = [];
  let i = start;
  while (i < tokens.length) {
    if (tokenIsPreviewSubcommand(tokens, i)) {
      const previewSpan = normalizeShellWord(tokens[i]) === "preview" ? 1 : 2;
      return { index: i, unknownGlobals, previewSpan };
    }
    if (tokens[i] === "--") {
      i += 1;
      continue;
    }
    if (tokens[i].startsWith("-")) {
      const token = tokens[i];
      if (
        !token.includes("=") &&
        !WRANGLER_GLOBAL_BOOLEAN_FLAGS.has(token) &&
        !WRANGLER_GLOBAL_VALUE_FLAGS.has(token)
      ) {
        unknownGlobals.push(token);
      }
      i = advancePastWranglerGlobalFlag(tokens, i);
      continue;
    }
    break;
  }
  return { index: -1, unknownGlobals, previewSpan: 0 };
}

/**
 * @param {string[]} tokens
 * @param {number} [start]
 * @returns {{ index: number, kind: "deploy" | "versions-deploy" | null, unknownGlobals: string[] }}
 */
function findWranglerDeploySubcommand(tokens, start = 0) {
  const unknownGlobals = [];
  let i = start;
  while (i < tokens.length) {
    if (cleanShellToken(tokens[i]) === "deploy") {
      return { index: i, kind: "deploy", unknownGlobals };
    }
    if (
      cleanShellToken(tokens[i]) === "versions" &&
      cleanShellToken(tokens[i + 1]) === "deploy"
    ) {
      return { index: i, kind: "versions-deploy", unknownGlobals };
    }
    if (tokens[i] === "--") {
      i += 1;
      continue;
    }
    if (tokens[i].startsWith("-")) {
      const token = tokens[i];
      if (
        !token.includes("=") &&
        !WRANGLER_GLOBAL_BOOLEAN_FLAGS.has(token) &&
        !WRANGLER_GLOBAL_VALUE_FLAGS.has(token)
      ) {
        unknownGlobals.push(token);
      }
      i = advancePastWranglerGlobalFlag(tokens, i);
      continue;
    }
    break;
  }
  return { index: -1, kind: null, unknownGlobals };
}

const SHELL_COMMAND_TERMINATORS = new Set([";", "&&", "||", "|"]);

/**
 * @param {string[]} tokens
 * @returns {string[]}
 */
export function stripShellRedirections(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    let token = tokens[i];
    if (token === "2>&1") {
      continue;
    }
    if (token.startsWith("2>&1") && token.length > 4) {
      token = token.slice(4);
    }
    if (token === ">" || token === ">>" || token === "<") {
      i += 1;
      continue;
    }
    if (/^[12]?>>?\/?$/.test(token)) {
      continue;
    }
    out.push(token);
  }
  return out;
}

/**
 * @param {string[]} tokens
 * @param {number} start
 * @returns {number}
 */
/**
 * @param {string} normalized
 * @param {number} wranglerEndIndex
 * @returns {number}
 */
function subshellDepthBeforeWrangler(normalized, wranglerEndIndex) {
  const before = normalized.slice(0, wranglerEndIndex);
  const opens = (before.match(/\$\(/g) ?? []).length;
  const closes = (before.match(/\)/g) ?? []).length;
  return Math.max(0, opens - closes);
}

/**
 * @param {string[]} tokens
 * @param {number} start
 * @param {number} [initialParenDepth]
 * @returns {number}
 */
function endOfWranglerCommandIndex(tokens, start, initialParenDepth = 0) {
  let depth = initialParenDepth;
  let j = start;
  while (j < tokens.length) {
    const token = tokens[j];
    if (depth <= 0 && SHELL_COMMAND_TERMINATORS.has(token)) {
      break;
    }
    if (depth <= 0 && (token === ")" || /\)"$/.test(token))) {
      break;
    }
    if (token === "$(") {
      depth += 1;
    }
    if (token === ")" || token === ')"' || token === "')") {
      depth -= 1;
      if (depth <= 0) {
        break;
      }
    }
    j += 1;
  }
  return j;
}

/**
 * @param {string} normalized
 * @param {number} wranglerIndex
 * @returns {string[]}
 */
function shellEnvAssignmentsBeforeWrangler(normalized, wranglerIndex) {
  const parenStart = normalized.lastIndexOf("$(", wranglerIndex);
  let searchStart = 0;
  if (parenStart !== -1 && parenStart < wranglerIndex) {
    searchStart = parenStart + 2;
  } else {
    searchStart =
      Math.max(
        normalized.lastIndexOf(";", wranglerIndex),
        normalized.lastIndexOf("&&", wranglerIndex),
        normalized.lastIndexOf("||", wranglerIndex),
        normalized.lastIndexOf("|", wranglerIndex),
      ) + 1;
  }
  const prefix = normalized.slice(searchStart, wranglerIndex);
  return prefix.match(/\b[A-Za-z_][A-Za-z0-9_]*=/g) ?? [];
}

/**
 * @param {string} normalized
 * @returns {string[]}
 */
/**
 * @param {string} normalized
 * @returns {string[]}
 */
export function extractWranglerDeploySegments(normalized) {
  const segments = [];
  const re = new RegExp(WRANGLER_BIN_RE.source, WRANGLER_BIN_RE.flags);
  let match = re.exec(normalized);
  while (match) {
    const wranglerEndIndex = match.index + match[0].length;
    const after = normalized.slice(wranglerEndIndex);
    let tokens = stripShellRedirections(tokenizeShellArgs(after.trim()));
    if (tokens[0] === "--") {
      tokens = tokens.slice(1);
    }
    const { index: subIdx, kind } = findWranglerDeploySubcommand(tokens, 0);
    if (subIdx === -1 || kind === null) {
      match = re.exec(normalized);
      continue;
    }
    const parenDepth = subshellDepthBeforeWrangler(normalized, wranglerEndIndex);
    const end =
      kind === "versions-deploy"
        ? endOfWranglerCommandIndex(tokens, subIdx + 2, parenDepth)
        : endOfWranglerCommandIndex(tokens, subIdx + 1, parenDepth);
    segments.push(["wrangler", ...tokens.slice(0, end)].join(" "));
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
    /--config[= ]wrangler\.gallery\.jsonc/.test(segment) ||
    /-c[= ]wrangler\.gallery\.jsonc/.test(segment)
  );
}

/**
 * @param {string} segment
 * @returns {boolean}
 */
function segmentRunsGalleryWranglerDeploy(segment) {
  if (!failClosedSegmentHasWranglerSubcommand(segment, "deploy")) {
    return false;
  }
  const deploySegments = extractWranglerDeploySegments(segment);
  if (deploySegments.some(referencesGalleryWranglerConfig)) {
    return true;
  }
  return referencesGalleryWranglerConfig(segment);
}

/**
 * @param {string} segment
 * @returns {boolean}
 */
function segmentRunsWranglerDeploy(segment) {
  if (failClosedSegmentHasWranglerSubcommand(segment, "deploy")) {
    return true;
  }
  return extractWranglerDeploySegments(segment).length > 0;
}

/**
 * @param {string} block
 * @param {string} subcommand
 * @returns {boolean}
 */
function arrayBlockReferencesGalleryWrangler(block, subcommand) {
  return (
    /['"]wrangler(?:@\S+)?['"]/.test(block) &&
    new RegExp(`['"]${subcommand}['"]`).test(block) &&
    /wrangler\.gallery\.jsonc/.test(block)
  );
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function detectArrayFormGalleryDeploy(text) {
  const callRe = /(?:spawnSync|execFileSync|execFile|spawn)\s*\(/g;
  let callMatch = callRe.exec(text);
  while (callMatch) {
    const slice = text.slice(callMatch.index, callMatch.index + 4000);
    const wranglerCmdMatch = slice.match(
      /["']wrangler(?:@\S+)?["']\s*,\s*\[([^\]]*)\]/,
    );
    if (
      wranglerCmdMatch &&
      /['"]deploy['"]/.test(wranglerCmdMatch[1]) &&
      /wrangler\.gallery\.jsonc/.test(wranglerCmdMatch[1])
    ) {
      return true;
    }
    const arrayMatch = slice.match(/\[[^\]]*\]/);
    if (arrayMatch && arrayBlockReferencesGalleryWrangler(arrayMatch[0], "deploy")) {
      return true;
    }
    callMatch = callRe.exec(text);
  }
  return false;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function detectArrayFormGalleryPreview(text) {
  const callRe = /(?:spawnSync|execFileSync|execFile|spawn)\s*\(/g;
  let callMatch = callRe.exec(text);
  while (callMatch) {
    const slice = text.slice(callMatch.index, callMatch.index + 4000);
    const wranglerCmdMatch = slice.match(
      /["']wrangler(?:@\S+)?["']\s*,\s*\[([^\]]*)\]/,
    );
    if (
      wranglerCmdMatch &&
      /['"]preview['"]/.test(wranglerCmdMatch[1]) &&
      /wrangler\.gallery\.jsonc/.test(wranglerCmdMatch[1])
    ) {
      return true;
    }
    const arrayMatch = slice.match(/\[[^\]]*\]/);
    if (arrayMatch && arrayBlockReferencesGalleryWrangler(arrayMatch[0], "preview")) {
      return true;
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
  const isYaml = options.isYaml ?? (label.endsWith(".yml") || label.endsWith(".yaml"));
  if (detectArrayFormGalleryPreview(text)) {
    return [
      `${label} must not run wrangler preview with wrangler.gallery.jsonc (only ${GALLERY_WORKFLOW}).`,
    ];
  }
  for (const segment of normalizedScanSegments(text, label, { isYaml })) {
    const invocations = extractWranglerPreviewInvocations(segment);
    for (const inv of invocations) {
      if (
        inv.envAssignments.length > 0 &&
        previewArgStringReferencesGalleryConfig(inv.argString)
      ) {
        return [
          `${label} must not run wrangler preview with shell env assignments and wrangler.gallery.jsonc (only ${GALLERY_WORKFLOW}).`,
        ];
      }
      if (previewArgStringReferencesGalleryConfig(inv.argString)) {
        return [
          `${label} must not run wrangler preview with wrangler.gallery.jsonc (only ${GALLERY_WORKFLOW}).`,
        ];
      }
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
    if (/\s/.test(s[i])) {
      i += 1;
      continue;
    }
    let token = "";
    while (i < s.length && !/\s/.test(s[i])) {
      const ch = s[i];
      if (ch === "'" || ch === '"') {
        if (ch === '"' && token.endsWith(")")) {
          token += ch;
          i += 1;
          break;
        }
        const quote = ch;
        i += 1;
        while (i < s.length && s[i] !== quote) {
          if (ch === '"' && s[i] === "\\" && i + 1 < s.length) {
            token += s[i + 1];
            i += 2;
          } else {
            token += s[i];
            i += 1;
          }
        }
        if (i < s.length && s[i] === quote) {
          i += 1;
        }
        continue;
      }
      token += s[i];
      i += 1;
    }
    if (token.length > 0) {
      tokens.push(token);
    }
  }
  return tokens;
}

/**
 * @param {string} normalizedWorkflow
 * @returns {{ argString: string, unknownGlobals: string[], envAssignments: string[] }[]}
 */
export function extractWranglerPreviewInvocations(normalizedWorkflow) {
  const invocations = [];
  let match = WRANGLER_BIN_RE.exec(normalizedWorkflow);
  while (match) {
    const wranglerEndIndex = match.index + match[0].length;
    const parenDepth = subshellDepthBeforeWrangler(
      normalizedWorkflow,
      wranglerEndIndex,
    );
    const envAssignments = shellEnvAssignmentsBeforeWrangler(
      normalizedWorkflow,
      match.index,
    );
    const rest = normalizedWorkflow.slice(wranglerEndIndex);
    let tokens = stripShellRedirections(tokenizeShellArgs(rest.trim()));
    if (tokens[0] === "--") {
      tokens = tokens.slice(1);
    }
    const {
      index: previewIdx,
      unknownGlobals,
      previewSpan,
    } = findWranglerPreviewSubcommand(tokens, 0);
    if (previewIdx === -1) {
      match = WRANGLER_BIN_RE.exec(normalizedWorkflow);
      continue;
    }
    const end = endOfWranglerCommandIndex(tokens, previewIdx + previewSpan, parenDepth);
    const argTokens = [
      ...tokens.slice(0, previewIdx),
      ...tokens.slice(previewIdx + previewSpan, end),
    ];
    const argString = argTokens
      .join(" ")
      .trim()
      .replace(/[")]+$/, "");
    invocations.push({ argString, unknownGlobals, envAssignments });
    match = WRANGLER_BIN_RE.exec(normalizedWorkflow);
  }
  return invocations;
}

/**
 * @param {string} normalizedWorkflow
 * @returns {string[]}
 */
export function extractWranglerPreviewArgStrings(normalizedWorkflow) {
  return extractWranglerPreviewInvocations(normalizedWorkflow).map(
    (inv) => inv.argString,
  );
}

/**
 * @param {string[]} tokens
 * @returns {{ flags: Map<string, string | true>, positionals: string[] }}
 */
const ALLOWED_PREVIEW_FLAGS = new Set(["--config", "--name", "--json"]);

function parsePreviewArgv(tokens) {
  const flags = new Map();
  const flagCounts = new Map();
  const positionals = [];
  const booleanFlags = new Set(["--json"]);
  const booleanWithValueErrors = [];

  const recordFlag = (flag, value) => {
    flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
    flags.set(flag, value);
  };

  for (let i = 0; i < tokens.length; i += 1) {
    let token = tokens[i];
    if (!token.startsWith("-")) {
      positionals.push(token);
      continue;
    }
    let flag = token;
    let valueFromEquals;
    const eqIdx = token.indexOf("=");
    if (eqIdx > 0 && token.startsWith("-")) {
      flag = token.slice(0, eqIdx);
      valueFromEquals = token.slice(eqIdx + 1);
    }
    if (booleanFlags.has(flag)) {
      if (valueFromEquals !== undefined) {
        booleanWithValueErrors.push(flag);
        continue;
      }
      recordFlag(flag, true);
      continue;
    }
    if (valueFromEquals !== undefined) {
      recordFlag(flag, valueFromEquals);
      continue;
    }
    const next = tokens[i + 1];
    if (next !== undefined && !next.startsWith("-")) {
      recordFlag(flag, next);
      i += 1;
    } else {
      recordFlag(flag, true);
    }
  }
  return { flags, positionals, flagCounts, booleanWithValueErrors };
}

/**
 * @param {string} argString
 * @returns {string[]}
 */
export function collectGalleryPreviewArgvViolations(argString) {
  const errors = [];
  const { flags, positionals, flagCounts, booleanWithValueErrors } = parsePreviewArgv(
    tokenizeShellArgs(argString),
  );

  if (positionals.length > 0) {
    errors.push(
      "gallery-preview.yml wrangler preview must not pass a positional Worker script.",
    );
  }

  for (const flag of booleanWithValueErrors) {
    errors.push(
      `gallery-preview.yml wrangler preview must not pass ${flag} with a value.`,
    );
  }

  for (const [flag, count] of flagCounts) {
    if (count > 1) {
      errors.push(`gallery-preview.yml wrangler preview must not repeat ${flag}.`);
    }
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
  if (flags.has("--ignore-base-config")) {
    errors.push(
      "gallery-preview.yml wrangler preview must not pass --ignore-base-config.",
    );
  }
  if (flags.has("--worker-name")) {
    errors.push("gallery-preview.yml wrangler preview must not pass --worker-name.");
  }
  if (!flags.has("--name")) {
    errors.push("gallery-preview.yml wrangler preview must pass --name.");
  }
  if (!flags.has("--json")) {
    errors.push("gallery-preview.yml wrangler preview must pass --json.");
  }

  const nameValue = flags.get("--name");
  if (typeof nameValue === "string" && /^\$[A-Za-z_][A-Za-z0-9_]*$/.test(nameValue)) {
    errors.push(
      "gallery-preview.yml wrangler preview --name must be a literal or double-quoted string.",
    );
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
  if (config.workers_dev !== true) {
    errors.push("wrangler.gallery.jsonc must set workers_dev to true.");
  }
  if (config.name !== "we-met-preview") {
    errors.push(
      'wrangler.gallery.jsonc name must remain "we-met-preview" (preview Worker only).',
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
  let runCommands = extractYamlRunCommands(workflowText).filter((command) => {
    const normalized = joinShellContinuations(command).replace(/\r?\n/g, " ");
    return extractWranglerPreviewInvocations(normalized).length > 0;
  });
  if (runCommands.length === 0 && /\bwrangler(?:@\S+)?\b/.test(workflowText)) {
    runCommands = [joinShellContinuations(workflowText).replace(/\r?\n/g, " ")];
  }
  if (runCommands.length === 0) {
    errors.push("gallery-preview.yml must invoke wrangler preview.");
    return errors;
  }
  for (const command of runCommands) {
    const normalized = joinShellContinuations(command).replace(/\r?\n/g, " ");
    const invocations = extractWranglerPreviewInvocations(normalized);
    if (invocations.length === 0) {
      errors.push("gallery-preview.yml must invoke wrangler preview.");
      continue;
    }
    for (const inv of invocations) {
      for (const flag of inv.unknownGlobals) {
        errors.push(
          `gallery-preview.yml wrangler preview must not pass wrangler global flag ${flag} before the preview subcommand.`,
        );
      }
      if (inv.envAssignments.length > 0) {
        errors.push(
          "gallery-preview.yml wrangler preview must not use shell env assignments on the command line.",
        );
      }
      errors.push(...collectGalleryPreviewArgvViolations(inv.argString));
    }
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
    for (const segment of normalizedScanSegments(text, label, {
      isYaml: options.isYaml ?? true,
    })) {
      if (segmentRunsWranglerDeploy(segment)) {
        errors.push(
          `${label} must not run wrangler deploy or wrangler versions deploy.`,
        );
        return errors;
      }
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
  const isYaml = options.isYaml ?? (label.endsWith(".yml") || label.endsWith(".yaml"));
  for (const segment of normalizedScanSegments(text, label, { isYaml })) {
    if (segmentRunsGalleryWranglerDeploy(segment)) {
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
