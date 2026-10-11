#!/usr/bin/env node
/**
 * Apply D1 migrations locally or to a remote database.
 *
 * Usage:
 *   node scripts/apply-migrations.mjs [--local]
 *   node scripts/apply-migrations.mjs --remote we-met-db-nonprod
 *
 * --local uses the WE_MET_DB binding from wrangler.jsonc (default).
 * --remote allowlists exactly one database name: we-met-db-nonprod (any other
 * name, binding, or ID is rejected). Writes wrangler.d1-nonprod.ci.jsonc at
 * repo root for the Wrangler invocation, then deletes it.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { WRANGLER_D1_NONPROD_CI_CONFIG } from "./lib/wrangler-placeholders.mjs";

const REMOTE_ALLOWED_DATABASE = "we-met-db-nonprod";
const D1_CI_CONFIG = resolve(WRANGLER_D1_NONPROD_CI_CONFIG);
const args = process.argv.slice(2);

let mode = "local";
let databaseName = null;

for (const arg of args) {
  if (arg === "--local") {
    mode = "local";
  } else if (arg === "--remote") {
    mode = "remote";
  } else if (arg.startsWith("-")) {
    console.error(`Unknown option: ${arg}`);
    process.exit(1);
  } else if (databaseName !== null) {
    console.error("Only one database name is allowed.");
    process.exit(1);
  } else {
    databaseName = arg;
  }
}

if (mode === "remote") {
  if (!databaseName) {
    console.error(
      `Usage: apply-migrations.mjs --remote ${REMOTE_ALLOWED_DATABASE}\n` +
        `Remote migrations are allowlisted to "${REMOTE_ALLOWED_DATABASE}" only.\n` +
        "Production migrations run only in the approved deploy workflow ([DIDI-572]).",
    );
    process.exit(1);
  }
  if (databaseName !== REMOTE_ALLOWED_DATABASE) {
    console.error(
      `Remote migrations are allowlisted to "${REMOTE_ALLOWED_DATABASE}" only.\n` +
        `Refusing target "${databaseName}".\n` +
        "Production migrations run only in the approved deploy workflow ([DIDI-572]).",
    );
    process.exit(1);
  }
}

let configFlag = [];

if (mode === "remote") {
  try {
    const prep = spawnSync(
      "node",
      [
        "scripts/prepare-wrangler-config.mjs",
        "--target",
        "d1-migrate-nonprod",
        "--output",
        D1_CI_CONFIG,
      ],
      { encoding: "utf8" },
    );
    if (prep.status !== 0) {
      if (prep.stderr) process.stderr.write(prep.stderr);
      process.exit(prep.status ?? 1);
    }
    configFlag = ["-c", D1_CI_CONFIG];
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

const wranglerTarget = mode === "remote" ? "--remote" : "--local";
const applyTarget = mode === "remote" ? databaseName : "WE_MET_DB";

let exitCode = 1;
try {
  const result = spawnSync(
    "npx",
    [
      "wrangler",
      ...configFlag,
      "d1",
      "migrations",
      "apply",
      applyTarget,
      wranglerTarget,
    ],
    { stdio: "inherit", shell: true },
  );
  exitCode = result.status ?? 1;
} finally {
  if (mode === "remote") {
    try {
      rmSync(D1_CI_CONFIG, { force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

process.exit(exitCode);
