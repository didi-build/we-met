#!/usr/bin/env node
/**
 * Ensures provisioning runs only from main-branch workflows (not pull_request preview).
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const WORKFLOWS_DIR = resolve(
  process.env.WE_MET_WORKFLOW_POLICY_ROOT ?? ".github/workflows",
);
const PROVISION_MARKER = "provision-resources.mjs";

function fail(message) {
  console.error(`workflow provision policy failed: ${message}`);
  process.exit(1);
}

/**
 * @param {string} line
 */
function stripYamlComment(line) {
  return line.replace(/#.*$/, "");
}

/**
 * @param {string} token
 */
function normalizeEventToken(token) {
  return token
    .replace(/^['"]|['"]$/g, "")
    .trim()
    .toLowerCase();
}

/**
 * @param {string} token
 */
function isWorkflowEventName(token) {
  return /^[a-z_][a-z0-9_-]*$/.test(token);
}

/**
 * @param {string[]} events
 * @returns {string[] | null}
 */
function normalizeEventList(events) {
  const normalized = events.map((part) => normalizeEventToken(part)).filter(Boolean);
  if (normalized.length === 0) return [];
  if (!normalized.every(isWorkflowEventName)) return null;
  return normalized;
}

/**
 * @param {string} rest
 * @returns {string[] | null}
 */
function parseFlowMapOnRest(rest) {
  const trimmed = rest.trim();
  if (!trimmed.startsWith("{")) return null;
  const close = trimmed.lastIndexOf("}");
  if (close <= 0) return null;
  const inner = trimmed.slice(1, close);
  /** @type {string[]} */
  const keys = [];
  let depth = 0;
  let keyStart = -1;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (depth === 0) {
      if (keyStart === -1 && /[A-Za-z_]/.test(c)) {
        keyStart = i;
      } else if (keyStart !== -1 && c === ":") {
        const key = inner.slice(keyStart, i).trim();
        if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key)) return null;
        keys.push(normalizeEventToken(key));
        keyStart = -1;
      }
    }
  }
  if (keyStart !== -1) return null;
  if (trimmed.length > close + 1 && trimmed.slice(close + 1).trim()) return null;
  const events = normalizeEventList(keys);
  if (!events || events.length === 0) return null;
  return events;
}

/**
 * @param {string} rest
 * @returns {string[] | null}
 */
function parseInlineOnRest(rest) {
  const trimmed = rest.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    return parseFlowMapOnRest(trimmed);
  }
  const bracket = /^\[([^\]]*)\]\s*$/.exec(trimmed);
  if (bracket) {
    const inner = bracket[1].trim();
    if (!inner) return [];
    return normalizeEventList(inner.split(",").map((part) => part.trim()));
  }
  const first = trimmed.split(/\s+/)[0];
  return normalizeEventList([first]);
}

/**
 * @param {string} content
 * @returns {string[] | null}
 */
export function parseWorkflowTriggerEvents(content) {
  const lines = content.split("\n");
  let onLineIndex = -1;
  let inlineEvents = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = raw.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent !== 0) continue;
    const noComment = stripYamlComment(raw).trimEnd();
    const inline = /^on:\s+(.+)$/.exec(noComment);
    if (inline) {
      inlineEvents = parseInlineOnRest(inline[1]);
      return inlineEvents;
    }
    const quotedInline = /^["']on["']:\s+(.+)$/.exec(noComment);
    if (quotedInline) {
      return null;
    }
    if (/^on:\s*$/.test(noComment) || /^["']on["']:\s*$/.test(noComment.trim())) {
      onLineIndex = i;
      break;
    }
  }

  if (onLineIndex === -1) {
    return inlineEvents;
  }

  const onIndent = 0;
  let childIndent = -1;
  /** @type {Set<string>} */
  const triggers = new Set();

  for (let i = onLineIndex + 1; i < lines.length; i++) {
    const raw = lines[i];
    const noComment = stripYamlComment(raw);
    const trimmed = noComment.trim();
    if (!trimmed) continue;
    const indent = noComment.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent <= onIndent) break;

    if (childIndent === -1) childIndent = indent;
    if (indent < childIndent) break;
    if (indent > childIndent) continue;

    const seqMatch = /^\s*-\s+([A-Za-z_][A-Za-z0-9_-]*)\s*:?\s*$/.exec(noComment);
    if (seqMatch) {
      const key = seqMatch[1].toLowerCase();
      if (!isWorkflowEventName(key)) return null;
      triggers.add(key);
      continue;
    }

    const keyMatch = /^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:/.exec(noComment);
    if (keyMatch) {
      const key = keyMatch[1].toLowerCase();
      if (!isWorkflowEventName(key)) return null;
      triggers.add(key);
      continue;
    }

    return null;
  }

  if (triggers.size === 0) return null;
  return [...triggers];
}

/**
 * @param {string[]} triggers
 */
export function workflowUsesPullRequestTrigger(triggers) {
  return triggers.includes("pull_request");
}

function workflowReferencesProvision(contents) {
  return contents.includes(PROVISION_MARKER);
}

function main() {
  const files = readdirSync(WORKFLOWS_DIR).filter(
    (name) => name.endsWith(".yml") || name.endsWith(".yaml"),
  );
  for (const file of files) {
    const path = resolve(WORKFLOWS_DIR, file);
    const contents = readFileSync(path, "utf8");
    if (!workflowReferencesProvision(contents)) continue;
    const triggers = parseWorkflowTriggerEvents(contents);
    if (!triggers || triggers.length === 0) {
      fail(
        `${file} uses ${PROVISION_MARKER} but workflow on: triggers could not be parsed`,
      );
    }
    if (workflowUsesPullRequestTrigger(triggers)) {
      fail(
        `${file} must not run ${PROVISION_MARKER} on pull_request (non-prod provision is main-branch only)`,
      );
    }
  }
  console.log("workflow provision policy passed");
}

main();
