#!/usr/bin/env node
/**
 * Compare applied remote D1 migration names with migrations/ on disk (warn-only output).
 *
 * Usage:
 *   node scripts/staging-d1-migration-drift.mjs --wrangler-json path/to/execute.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildStagingMigrationDriftReport,
  formatAppliedMigrationNamesForLog,
  parseAppliedMigrationNamesFromWranglerExecute,
  redactD1UuidsInText,
} from "./lib/staging-d1-migration-drift.mjs";

function parseArgs(argv) {
  let wranglerJsonPath = null;
  let logAppliedNames = false;
  let printRedactedStderrPath = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--wrangler-json") {
      wranglerJsonPath = resolve(argv[++i] ?? "");
    } else if (arg === "--log-applied-names") {
      logAppliedNames = true;
    } else if (arg === "--print-redacted-stderr") {
      printRedactedStderrPath = resolve(argv[++i] ?? "");
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: staging-d1-migration-drift.mjs --wrangler-json <path>");
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  if (printRedactedStderrPath) {
    return { wranglerJsonPath, logAppliedNames, printRedactedStderrPath };
  }
  if (!wranglerJsonPath) {
    console.error("--wrangler-json is required");
    process.exit(1);
  }
  return { wranglerJsonPath, logAppliedNames, printRedactedStderrPath };
}

function main() {
  const { wranglerJsonPath, logAppliedNames, printRedactedStderrPath } = parseArgs(
    process.argv.slice(2),
  );
  if (printRedactedStderrPath) {
    const raw = readFileSync(printRedactedStderrPath, "utf8");
    process.stderr.write(redactD1UuidsInText(raw));
    return;
  }
  const raw = readFileSync(wranglerJsonPath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("::error::wrangler execute JSON was not valid");
    process.exit(1);
  }
  if (logAppliedNames) {
    const applied = parseAppliedMigrationNamesFromWranglerExecute(parsed);
    process.stdout.write(`${formatAppliedMigrationNamesForLog(applied)}\n`);
    return;
  }
  const report = buildStagingMigrationDriftReport(process.cwd(), parsed);
  if (report.remoteOnly.length > 0) {
    for (const name of report.remoteOnly) {
      console.warn(`::warning::Remote-only D1 migration applied: ${name}`);
    }
  }
  process.stdout.write(`${report.markdown}\n`);
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main();
}
