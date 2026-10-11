#!/usr/bin/env node
/**
 * Prepare wrangler.ci.jsonc with dummy D1 IDs and run wrangler deploy --dry-run.
 * Proves generated config paths resolve from the repository root.
 */
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { WRANGLER_CI_CONFIG } from "./lib/wrangler-placeholders.mjs";

const output = resolve(WRANGLER_CI_CONFIG);

const prep = spawnSync(
  "node",
  ["scripts/prepare-wrangler-config.mjs", "--target", "production", "--output", output],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      WE_MET_D1_DATABASE_ID_PRODUCTION: "11111111-1111-1111-1111-111111111111",
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
    ["wrangler", "deploy", "--dry-run", "--config", output],
    { stdio: "inherit", shell: true },
  );
  exitCode = dry.status ?? 1;
} finally {
  try {
    rmSync(output, { force: true });
  } catch {
    // ignore
  }
}

process.exit(exitCode);
