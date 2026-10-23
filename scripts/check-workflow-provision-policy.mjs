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

function workflowUsesPullRequestTrigger(contents) {
  return /^\s*pull_request\s*:/m.test(contents);
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
    if (workflowUsesPullRequestTrigger(contents)) {
      fail(
        `${file} must not run ${PROVISION_MARKER} on pull_request (non-prod provision is main-branch only)`,
      );
    }
  }
  console.log("workflow provision policy passed");
}

main();
