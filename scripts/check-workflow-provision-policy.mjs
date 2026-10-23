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
 * @param {string} rest
 * @returns {string[] | null}
 */
function parseInlineOnRest(rest) {
  const trimmed = rest.trim();
  if (!trimmed) return null;
  const bracket = /^\[([^\]]*)\]\s*$/.exec(trimmed);
  if (bracket) {
    const inner = bracket[1].trim();
    if (!inner) return [];
    return inner
      .split(",")
      .map((part) => normalizeEventToken(part))
      .filter(Boolean);
  }
  const first = trimmed.split(/\s+/)[0];
  return [normalizeEventToken(first)];
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
      triggers.add(seqMatch[1].toLowerCase());
      continue;
    }

    const keyMatch = /^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:/.exec(noComment);
    if (keyMatch) {
      triggers.add(keyMatch[1].toLowerCase());
      continue;
    }

    return null;
  }

  return triggers.size > 0 ? [...triggers] : null;
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
  const files = readdirSync(WORKFLOWS_DIR).filter((name) => name.endsWith(".yml"));
  for (const file of files) {
    const path = resolve(WORKFLOWS_DIR, file);
    const contents = readFileSync(path, "utf8");
    if (!workflowReferencesProvision(contents)) continue;
    const triggers = parseWorkflowTriggerEvents(contents);
    if (!triggers) {
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
