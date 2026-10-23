#!/usr/bin/env node
/**
 * Create-if-missing Cloudflare D1 databases and R2 buckets declared in Wrangler config.
 *
 * Usage:
 *   node scripts/provision-resources.mjs --target production --config wrangler.jsonc
 *   node scripts/provision-resources.mjs --target nonprod --config wrangler.jsonc
 *
 * Environment:
 *   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID — required for live Wrangler calls
 *   WE_MET_D1_DATABASE_ID_PRODUCTION — validated against Cloudflare for production D1
 *   WE_MET_D1_DATABASE_ID_NONPROD — validated for non-prod D1 (logs masked)
 */
import { execFile as execFileCb } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { parseJsonc } from "./lib/parse-jsonc.mjs";
import {
  buildProvisionPlan,
  collectDeclaredResources,
  createWranglerRunner,
  d1EnvVarForDatabaseName,
  executeProvisionPlan,
  maskIdForLog,
  validateDeclaredNames,
  validateD1IdsAgainstEnv,
} from "./lib/provision-resources.mjs";

const execFile = promisify(execFileCb);

const CONSUMER_DIR = "workers/we-met-followup-email-consumer";
const CONSUMER_PRODUCTION = `${CONSUMER_DIR}/wrangler.production.jsonc`;
const CONSUMER_NONPROD = `${CONSUMER_DIR}/wrangler.nonprod.jsonc`;

function usage() {
  console.error(
    "Usage: provision-resources.mjs --target <production|nonprod> --config <wrangler.jsonc> [--resources d1,r2]",
  );
  process.exit(1);
}

function parseResourcesFlag(raw) {
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const includeD1 = parts.includes("d1");
  const includeR2 = parts.includes("r2");
  if (!includeD1 && !includeR2) {
    console.error('--resources must include "d1" and/or "r2"');
    process.exit(1);
  }
  return { includeD1, includeR2 };
}

function parseArgs(argv) {
  let target = null;
  let configPath = "wrangler.jsonc";
  let includeD1 = true;
  let includeR2 = true;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--target") target = argv[++i];
    else if (arg === "--config") configPath = argv[++i];
    else if (arg === "--resources") {
      const parsed = parseResourcesFlag(argv[++i] ?? "");
      includeD1 = parsed.includeD1;
      includeR2 = parsed.includeR2;
    } else if (arg === "--help" || arg === "-h") usage();
    else {
      console.error(`Unknown argument: ${arg}`);
      usage();
    }
  }
  if (target !== "production" && target !== "nonprod") usage();
  return { target, configPath, includeD1, includeR2 };
}

function loadConsumerConfig(target) {
  const path = target === "production" ? CONSUMER_PRODUCTION : CONSUMER_NONPROD;
  return parseJsonc(readFileSync(path, "utf8"));
}

function fail(message) {
  console.error(`provision-resources: ${message}`);
  process.exit(1);
}

async function main() {
  const { target, configPath, includeD1, includeR2 } = parseArgs(process.argv.slice(2));
  const mainConfig = parseJsonc(readFileSync(configPath, "utf8"));
  const consumerConfig = loadConsumerConfig(target);

  const { d1, r2 } = collectDeclaredResources(mainConfig, consumerConfig, target, {
    includeD1,
    includeR2,
  });
  const nameErrors = validateDeclaredNames(d1, r2, target);
  if (nameErrors.length > 0) {
    for (const err of nameErrors) fail(err);
  }

  if (!process.env.CLOUDFLARE_API_TOKEN?.trim()) {
    fail("CLOUDFLARE_API_TOKEN is required");
  }

  const wrangler = createWranglerRunner(execFile, {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  });

  const existingD1 = await wrangler.listD1Databases();
  const existingR2 = await wrangler.listR2Buckets();
  const plan = buildProvisionPlan(d1, r2, existingD1, existingR2);

  const { log, resolvedD1Ids } = await executeProvisionPlan(plan, wrangler, existingD1);

  for (const entry of log) {
    console.log(`provision: ${entry.message}`);
  }

  for (const [databaseName, id] of Object.entries(resolvedD1Ids)) {
    const envName = d1EnvVarForDatabaseName(databaseName, target);
    console.log(
      `provision: D1 ${databaseName} id=${maskIdForLog(id, target)} (${envName})`,
    );
  }

  const envErrors = validateD1IdsAgainstEnv(resolvedD1Ids, target, process.env);
  if (envErrors.length > 0) {
    for (const err of envErrors) fail(err);
  }

  console.log(`provision: complete (${target})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
