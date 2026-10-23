#!/usr/bin/env node
/**
 * Create-if-missing Cloudflare D1 databases and R2 buckets declared in Wrangler config.
 *
 * Uses the Cloudflare REST API (fetch) for exact-name lookups and creates.
 * D1 ids are written to --output JSON only; they are never printed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCloudflareProvisionClient } from "./lib/cloudflare-provision-api.mjs";
import { parseJsonc } from "./lib/parse-jsonc.mjs";
import { runProvisionForDeclared } from "./lib/provision-run.mjs";
import {
  collectDeclaredResources,
  DEFAULT_PROVISION_D1_IDS_FILE,
  validateConsumerMatchesApp,
  validateDeclaredNames,
} from "./lib/provision-resources.mjs";

const CONSUMER_DIR = "workers/we-met-followup-email-consumer";
const CONSUMER_PRODUCTION = `${CONSUMER_DIR}/wrangler.production.jsonc`;
const CONSUMER_NONPROD = `${CONSUMER_DIR}/wrangler.nonprod.jsonc`;

function usage() {
  console.error(
    "Usage: provision-resources.mjs --target <production|nonprod> --config <wrangler.jsonc> [--resources d1,r2] [--output <provision-d1-ids.json>]",
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
  let outputPath = DEFAULT_PROVISION_D1_IDS_FILE;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--target") target = argv[++i];
    else if (arg === "--config") configPath = argv[++i];
    else if (arg === "--output") outputPath = argv[++i];
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
  return { target, configPath, includeD1, includeR2, outputPath: resolve(outputPath) };
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
  const { target, configPath, includeD1, includeR2, outputPath } = parseArgs(
    process.argv.slice(2),
  );
  const mainConfig = parseJsonc(readFileSync(configPath, "utf8"));
  const consumerConfig = loadConsumerConfig(target);
  const resourceOptions = { includeD1, includeR2 };

  const consumerErrors = validateConsumerMatchesApp(
    mainConfig,
    consumerConfig,
    target,
    resourceOptions,
  );
  if (consumerErrors.length > 0) {
    for (const err of consumerErrors) fail(err);
  }

  const { d1, r2 } = collectDeclaredResources(
    mainConfig,
    consumerConfig,
    target,
    resourceOptions,
  );
  const nameErrors = validateDeclaredNames(d1, r2, target);
  if (nameErrors.length > 0) {
    for (const err of nameErrors) fail(err);
  }

  const api = createCloudflareProvisionClient(fetch, {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    apiToken: process.env.CLOUDFLARE_API_TOKEN ?? "",
  });

  const { envErrors } = await runProvisionForDeclared({
    target,
    d1,
    r2,
    api,
    env: process.env,
    outputPath,
  });

  if (envErrors.length > 0) {
    for (const err of envErrors) fail(err);
  }

  console.log(`provision: complete (${target})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
