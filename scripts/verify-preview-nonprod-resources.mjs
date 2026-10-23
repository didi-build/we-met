#!/usr/bin/env node
/**
 * Fail preview deploy when the PR declares non-prod D1/R2 not present on main yet.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parseJsonc } from "./lib/parse-jsonc.mjs";
import {
  findPreviewBlockedResources,
  formatPreviewMissingResourceMessage,
} from "./lib/preview-nonprod-resource-gate.mjs";

const MAIN_REF = process.env.WE_MET_PREVIEW_MAIN_REF?.trim() || "origin/main";
const WRANGLER = "wrangler.jsonc";
const CONSUMER = "workers/we-met-followup-email-consumer/wrangler.nonprod.jsonc";

function gitShow(path) {
  const result = spawnSync("git", ["show", `${MAIN_REF}:${path}`], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(
      `verify-preview-nonprod-resources: could not read ${path} at ${MAIN_REF} (${result.stderr || result.stdout})`,
    );
    process.exit(1);
  }
  return result.stdout;
}

function tryLoadConfigFromGit(path) {
  const result = spawnSync("git", ["show", `${MAIN_REF}:${path}`], {
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  try {
    return parseJsonc(result.stdout);
  } catch {
    return null;
  }
}

function loadConfigFromDisk(path) {
  return parseJsonc(readFileSync(resolve(path), "utf8"));
}

function main() {
  const mainWrangler = parseJsonc(gitShow(WRANGLER));
  const mainConsumer = tryLoadConfigFromGit(CONSUMER);
  const prWrangler = loadConfigFromDisk(WRANGLER);
  let prConsumer = null;
  try {
    prConsumer = loadConfigFromDisk(CONSUMER);
  } catch {
    prConsumer = null;
  }

  const missing = findPreviewBlockedResources(
    mainWrangler,
    mainConsumer,
    prWrangler,
    prConsumer,
  );

  if (missing.length === 0) {
    console.log("preview non-prod resource gate passed");
    return;
  }

  const message = formatPreviewMissingResourceMessage(missing);
  console.error(message);
  for (const entry of missing) {
    console.error(`::error::${formatPreviewMissingResourceMessage([entry])}`);
  }
  process.exit(1);
}

main();
