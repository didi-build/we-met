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
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseJsonc } from "./lib/parse-jsonc.mjs";
import { WRANGLER_D1_NONPROD_CI_CONFIG } from "./lib/wrangler-placeholders.mjs";

const REMOTE_ALLOWED_DATABASE = "we-met-db-nonprod";
// Relative path for Wrangler CLI (shell:true breaks on absolute paths with spaces).
const D1_CI_CONFIG_REL = WRANGLER_D1_NONPROD_CI_CONFIG;
const D1_CI_CONFIG_ABS = resolve(D1_CI_CONFIG_REL);
const args = process.argv.slice(2);

let mode = "local";
let databaseName = null;
let migrationsDir = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--local") {
    mode = "local";
  } else if (arg === "--remote") {
    mode = "remote";
  } else if (arg === "--migrations-dir") {
    migrationsDir = args[++i];
    if (!migrationsDir) {
      console.error("--migrations-dir requires a path");
      process.exit(1);
    }
  } else if (arg === "--config") {
    console.error(
      "--config is not supported; remote apply always uses the generated d1-migrate-nonprod wrangler config.",
    );
    process.exit(1);
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
let configRel = D1_CI_CONFIG_REL;
let configAbs = D1_CI_CONFIG_ABS;
let wroteConfig = false;

if (mode === "remote") {
  try {
    const prep = spawnSync(
      "node",
      [
        "scripts/prepare-wrangler-config.mjs",
        "--target",
        "d1-migrate-nonprod",
        "--output",
        D1_CI_CONFIG_REL,
      ],
      { encoding: "utf8" },
    );
    if (prep.status !== 0) {
      if (prep.stderr) process.stderr.write(prep.stderr);
      process.exit(prep.status ?? 1);
    }
    wroteConfig = true;
    configFlag = ["-c", configRel];
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

if (migrationsDir && mode !== "remote") {
  console.error("--migrations-dir is only supported with --remote");
  process.exit(1);
}

const wranglerTarget = mode === "remote" ? "--remote" : "--local";
const applyTarget = mode === "remote" ? databaseName : "WE_MET_DB";

if (migrationsDir && mode === "remote") {
  const configText = readFileSync(configAbs, "utf8");
  const config = parseJsonc(configText);
  config.migrations_dir = migrationsDir;
  if (Array.isArray(config.d1_databases)) {
    for (const entry of config.d1_databases) {
      entry.migrations_dir = migrationsDir;
    }
  }
  writeFileSync(configAbs, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

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
  if (mode === "remote" && wroteConfig) {
    try {
      rmSync(D1_CI_CONFIG_ABS, { force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

process.exit(exitCode);
