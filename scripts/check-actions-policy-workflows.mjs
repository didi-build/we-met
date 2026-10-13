import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const ACTIONS_POLICY_CONFIG_PATH = ".github/actions-policy-workflows.json";
export const WORKFLOWS_DIR = ".github/workflows";

export const CANNOT_DETERMINE_TRIGGERS = "cannot determine workflow triggers";

/**
 * @param {string} repoPath
 * @param {string} [detail]
 */
export function cannotDetermineTriggersMessage(repoPath, detail) {
  const suffix = detail ? ` (${detail})` : "";
  return `${repoPath}: ${CANNOT_DETERMINE_TRIGGERS}${suffix}; use block-style \`on:\` with one event per line or list item, then update ${ACTIONS_POLICY_CONFIG_PATH} and the GitHub policy if needed.`;
}

/**
 * @param {string} line
 */
function stripYamlComment(line) {
  return line.replace(/#.*$/, "");
}

/**
 * @param {string} content
 * @returns {{ ok: true; triggers: string[] } | { ok: false; reason: string }}
 */
export function parseWorkflowOnTriggerEvents(content) {
  const lines = content.split("\n");
  let onLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const indent = raw.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent !== 0) {
      continue;
    }
    const noComment = stripYamlComment(raw).trimEnd();

    if (/^on:\s*$/.test(noComment) || /^["']on["']:\s*$/.test(noComment.trim())) {
      onLineIndex = i;
      break;
    }
    if (/^on:\s+\S/.test(noComment) || /^["']on["']:\s+\S/.test(noComment.trim())) {
      return { ok: false, reason: "inline on form" };
    }
  }

  if (onLineIndex === -1) {
    return { ok: false, reason: "missing on key" };
  }

  const onIndent = 0;
  let childIndent = -1;
  /** @type {Set<string>} */
  const triggers = new Set();
  let sawDirectChild = false;

  for (let i = onLineIndex + 1; i < lines.length; i++) {
    const raw = lines[i];
    const noComment = stripYamlComment(raw);
    const trimmed = noComment.trim();
    if (!trimmed) {
      continue;
    }
    const indent = noComment.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent <= onIndent) {
      break;
    }

    if (childIndent === -1) {
      childIndent = indent;
    }

    if (indent < childIndent) {
      break;
    }

    if (indent > childIndent) {
      continue;
    }

    const seqMatch = /^\s*-\s+([A-Za-z_][A-Za-z0-9_-]*)\s*:?\s*$/.exec(noComment);
    if (seqMatch) {
      triggers.add(seqMatch[1].toLowerCase());
      sawDirectChild = true;
      continue;
    }

    const keyMatch = /^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:/.exec(noComment);
    if (keyMatch) {
      triggers.add(keyMatch[1].toLowerCase());
      sawDirectChild = true;
      continue;
    }

    if (/^\s*-\s+/.test(noComment)) {
      return { ok: false, reason: "unparsed on block sequence entry" };
    }

    return { ok: false, reason: "unparsed on block line" };
  }

  if (!sawDirectChild || triggers.size === 0) {
    return { ok: false, reason: "empty on block" };
  }

  return { ok: true, triggers: [...triggers].sort() };
}

/**
 * @param {string} content
 * @returns {boolean}
 */
export function hasInlineWorkflowOnClause(content) {
  for (const line of content.split("\n")) {
    const noComment = stripYamlComment(line).trimEnd();
    const match = /^\s*on:\s*(.*)$/.exec(noComment);
    if (match) {
      const rest = match[1].trim();
      if (rest.length > 0) {
        return true;
      }
      return false;
    }
    const quoted = /^\s*["']on["']:\s*(.*)$/.exec(noComment.trim());
    if (quoted) {
      const rest = quoted[1].trim();
      if (rest.length > 0) {
        return true;
      }
      return false;
    }
  }
  return false;
}

/**
 * @param {string} jsonText
 */
export function parseActionsPolicyConfig(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed.allowedEvents) || !Array.isArray(parsed.workflows)) {
    throw new TypeError(
      "actions policy config must include allowedEvents and workflows arrays",
    );
  }
  return parsed;
}

/**
 * @param {string} filename
 */
export function workflowPathFromFilename(filename) {
  return `${WORKFLOWS_DIR}/${filename}`;
}

/**
 * @param {{
 *   repoRoot: string;
 *   config: { allowedEvents: string[]; workflows: string[] };
 *   workflowsDir: string;
 * }} opts
 * @returns {string[]}
 */
export function findActionsPolicyWorkflowViolations({
  repoRoot,
  config,
  workflowsDir,
}) {
  const violations = [];
  const allowedEvents = new Set(config.allowedEvents.map((e) => e.toLowerCase()));
  const listedPaths = new Set(config.workflows);

  for (const repoPath of config.workflows) {
    const basename = repoPath.replace(/^\.github\/workflows\//, "");
    const fullPath = join(workflowsDir, basename);
    if (!existsSync(fullPath)) {
      violations.push(
        `${repoPath} is listed in ${ACTIONS_POLICY_CONFIG_PATH} but missing under ${WORKFLOWS_DIR}/; add the workflow file or remove it from the JSON and the GitHub Actions policy.`,
      );
    }
  }

  if (!existsSync(workflowsDir)) {
    return violations;
  }

  const files = readdirSync(workflowsDir).filter(
    (name) => name.endsWith(".yml") || name.endsWith(".yaml"),
  );

  for (const filename of files) {
    const repoPath = workflowPathFromFilename(filename);
    const content = readFileSync(join(workflowsDir, filename), "utf8");

    const parsed = parseWorkflowOnTriggerEvents(content);
    if (!parsed.ok) {
      violations.push(cannotDetermineTriggersMessage(repoPath, parsed.reason));
      continue;
    }

    const triggerList = parsed.triggers.map((t) => t.toLowerCase());

    if (triggerList.includes("pull_request_target") && !listedPaths.has(repoPath)) {
      violations.push(
        `${repoPath} uses pull_request_target but is not listed in ${ACTIONS_POLICY_CONFIG_PATH}; add it to the JSON and the GitHub Actions policy target list.`,
      );
    }

    if (listedPaths.has(repoPath)) {
      for (const trigger of triggerList) {
        if (!allowedEvents.has(trigger)) {
          violations.push(
            `${repoPath} uses trigger ${trigger}, which is not in allowedEvents for targeted workflows; add ${trigger} to ${ACTIONS_POLICY_CONFIG_PATH} and the GitHub policy allowed events, or remove the trigger from the workflow.`,
          );
        }
      }
    }
  }

  return violations;
}

/**
 * @param {string} repoRoot
 */
export function checkActionsPolicyWorkflowsAtRepoRoot(repoRoot) {
  const configPath = join(repoRoot, ACTIONS_POLICY_CONFIG_PATH);
  const config = parseActionsPolicyConfig(readFileSync(configPath, "utf8"));
  const workflowsDir = join(repoRoot, WORKFLOWS_DIR);
  return findActionsPolicyWorkflowViolations({ repoRoot, config, workflowsDir });
}

function runCli() {
  const repoRoot = process.cwd();
  const violations = checkActionsPolicyWorkflowsAtRepoRoot(repoRoot);
  if (violations.length > 0) {
    console.error(
      "Actions policy workflow guard failed (compare .github/workflows/ to .github/actions-policy-workflows.json and GitHub Settings > Actions > Policies):\n",
    );
    for (const message of violations) {
      console.error(`  - ${message}`);
    }
    process.exit(1);
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runCli();
}
