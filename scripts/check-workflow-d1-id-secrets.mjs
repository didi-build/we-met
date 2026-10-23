#!/usr/bin/env node
/**
 * Fail CI if a workflow passes D1 database ids through GitHub variables in step env.
 * Variables are echoed in Actions logs; secrets are masked.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const WORKFLOWS_DIR = resolve(
  process.env.WE_MET_WORKFLOW_POLICY_ROOT ?? ".github/workflows",
);

const FORBIDDEN = [
  "vars.WE_MET_D1_DATABASE_ID_PRODUCTION",
  "vars.WE_MET_D1_DATABASE_ID_NONPROD",
];

function fail(message) {
  console.error(`workflow D1 id masking failed: ${message}`);
  process.exit(1);
}

function main() {
  const files = readdirSync(WORKFLOWS_DIR).filter((name) => name.endsWith(".yml"));
  for (const file of files) {
    const path = resolve(WORKFLOWS_DIR, file);
    const contents = readFileSync(path, "utf8");
    for (const needle of FORBIDDEN) {
      if (contents.includes(needle)) {
        fail(
          `${file} must not use ${needle} in workflow env (use secrets.${needle.slice(5)} instead)`,
        );
      }
    }
  }
  console.log("workflow D1 id masking passed");
}

main();
