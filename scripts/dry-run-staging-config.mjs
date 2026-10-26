#!/usr/bin/env node
/**
 * Prepare wrangler.staging.ci.jsonc with dummy D1 IDs and run wrangler deploy --dry-run.
 */
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { WRANGLER_STAGING_CI_CONFIG } from "./lib/wrangler-placeholders.mjs";

const configRel = WRANGLER_STAGING_CI_CONFIG;
const configAbs = resolve(configRel);

const prep = spawnSync(
  "node",
  ["scripts/prepare-wrangler-config.mjs", "--target", "staging", "--output", configRel],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      WE_MET_D1_DATABASE_ID_NONPROD: "22222222-2222-2222-2222-222222222222",
    },
  },
);

if (prep.status !== 0) {
  if (prep.stderr) process.stderr.write(prep.stderr);
  process.exit(prep.status ?? 1);
}

let exitCode = 1;
try {
  const dry = spawnSync(
    "npx",
    ["wrangler", "deploy", "--dry-run", "--config", configRel],
    { stdio: "inherit", shell: true },
  );
  exitCode = dry.status ?? 1;
} finally {
  try {
    rmSync(configAbs, { force: true });
  } catch {
    // ignore
  }
}

process.exit(exitCode);
