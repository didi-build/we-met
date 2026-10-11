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
 * name, binding, or ID is rejected). Production migrations run only in the
 * approved deploy workflow ([DIDI-572]).
 */
import { spawnSync } from "node:child_process";

const REMOTE_ALLOWED_DATABASE = "we-met-db-nonprod";
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

const wranglerTarget = mode === "remote" ? "--remote" : "--local";
const applyTarget = mode === "remote" ? databaseName : "WE_MET_DB";

const result = spawnSync(
  "npx",
  ["wrangler", "d1", "migrations", "apply", applyTarget, wranglerTarget],
  { stdio: "inherit", shell: true },
);

process.exit(result.status ?? 1);
