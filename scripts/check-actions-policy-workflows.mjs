import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { extractWorkflowMetadata } from "./lib/privileged-workflow-extract.mjs";

export const ACTIONS_POLICY_CONFIG_PATH = ".github/actions-policy-workflows.json";
export const WORKFLOWS_DIR = ".github/workflows";

/**
 * @param {string} content
 * @returns {string}
 */
export function extractWorkflowOnBlock(content) {
  const lines = content.split("\n");
  /** @type {string[]} */
  const sectionLines = [];
  let inOn = false;
  let onIndent = -1;

  for (const line of lines) {
    if (/^\s*on:\s*$/.test(line)) {
      inOn = true;
      onIndent = line.match(/^\s*/)?.[0].length ?? 0;
      sectionLines.push(line);
      continue;
    }
    if (inOn) {
      const trimmed = line.trimEnd();
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      if (trimmed && indent <= onIndent) {
        break;
      }
      sectionLines.push(line);
    }
  }

  return sectionLines.join("\n");
}

/**
 * @param {string} content
 * @returns {string[]}
 */
export function listWorkflowTriggerEvents(content) {
  if (hasInlineWorkflowOnClause(content)) {
    return [];
  }
  const onBlock = extractWorkflowOnBlock(content);
  if (!onBlock) {
    return [];
  }
  return extractWorkflowMetadata(onBlock).triggers;
}

/**
 * @param {string} content
 * @returns {boolean}
 */
export function hasInlineWorkflowOnClause(content) {
  for (const line of content.split("\n")) {
    const match = /^\s*on:\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }
    const rest = match[1].trim();
    if (rest.length > 0 && !rest.startsWith("#")) {
      return true;
    }
    return false;
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

    if (hasInlineWorkflowOnClause(content)) {
      violations.push(
        `${repoPath}: cannot determine workflow triggers (inline \`on:\` form); use block-style \`on:\` with one trigger per line, or add explicit support. Until fixed, update ${ACTIONS_POLICY_CONFIG_PATH} and the GitHub policy manually.`,
      );
      continue;
    }

    const triggerList = listWorkflowTriggerEvents(content).map((t) => t.toLowerCase());

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
