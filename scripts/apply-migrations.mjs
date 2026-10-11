#!/usr/bin/env node
/**
 * Apply D1 migrations locally or to a remote database.
 * Usage: node scripts/apply-migrations.mjs [--local | --remote]
 * Default: --local
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const target = args.includes("--remote") ? "--remote" : "--local";
if (args.some((a) => a !== "--local" && a !== "--remote")) {
  console.error("Usage: apply-migrations.mjs [--local | --remote]");
  process.exit(1);
}

const result = spawnSync(
  "npx",
  ["wrangler", "d1", "migrations", "apply", "WE_MET_DB", target],
  { stdio: "inherit", shell: true },
);

process.exit(result.status ?? 1);
