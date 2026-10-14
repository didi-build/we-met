import { appendFileSync } from "node:fs";
import {
  executePlanSetupSoftFail,
  executePlanStepCrashSoftFail,
} from "./plan-soft-fail.mjs";

function pickFailedSetupStep() {
  const order = [
    ["checkout", process.env.CHECKOUT_OUTCOME],
    ["setup-node", process.env.SETUP_NODE_OUTCOME],
    ["npm-ci", process.env.NPM_CI_OUTCOME],
  ];
  for (const [id, outcome] of order) {
    if (outcome === "failure") {
      return id;
    }
  }
  return null;
}

let result;
if (process.env.PLAN_STEP_OUTCOME === "failure") {
  result = executePlanStepCrashSoftFail();
} else {
  const failedStep = pickFailedSetupStep() ?? "unknown";
  result = executePlanSetupSoftFail(failedStep);
}

const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) {
  appendFileSync(summaryFile, `${result.summaryMarkdown}\n`);
}
process.exit(result.exitCode);
