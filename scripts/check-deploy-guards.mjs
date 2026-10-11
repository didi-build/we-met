#!/usr/bin/env node
/**
 * Deploy-time guards from docs/architecture/environments.md#deploy-time-guards
 *
 * Usage:
 *   node scripts/check-deploy-guards.mjs --target preview --config wrangler.jsonc
 *   node scripts/check-deploy-guards.mjs --target production --config wrangler.jsonc
 *
 * Production target also requires GITHUB_ENVIRONMENT=production when WE_MET_ENV is production.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseJsonc } from "./lib/parse-jsonc.mjs";
import {
  NONPROD_RESOURCE_MARKERS,
  PRODUCTION_RESOURCE_MARKERS,
} from "./lib/wrangler-placeholders.mjs";

function usage() {
  console.error(
    "Usage: check-deploy-guards.mjs --target <preview|production> --config <path>",
  );
  process.exit(1);
}

function parseArgs(argv) {
  let target = null;
  let configPath = resolve("wrangler.jsonc");
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--target") target = argv[++i];
    else if (arg === "--config") configPath = resolve(argv[++i]);
    else if (arg === "--help" || arg === "-h") usage();
    else {
      console.error(`Unknown argument: ${arg}`);
      usage();
    }
  }
  if (!target) usage();
  return { target, configPath };
}

function collectStrings(value, out = []) {
  if (value === null || value === undefined) return out;
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return out;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
  return out;
}

function fail(message) {
  console.error(`deploy-time guard failed: ${message}`);
  process.exit(1);
}

function checkNonprodMailSafety() {
  const path = resolve("config/nonprod-mail-safety.json");
  let spec;
  try {
    spec = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`missing or invalid ${path}`);
  }
  if (spec.failClosedIfUnset !== true) {
    fail("nonprod mail safety must fail closed when WE_MET_TEST_MAIL_TO is unset");
  }
  if (spec.redirectEnvVar !== "WE_MET_TEST_MAIL_TO") {
    fail("nonprod mail redirect must use WE_MET_TEST_MAIL_TO");
  }
  if (spec.consumerWorkerName !== NONPROD_RESOURCE_MARKERS.consumerWorkerName) {
    fail("nonprod consumer worker name mismatch in config/nonprod-mail-safety.json");
  }
}

function checkPreviewBlock(previews) {
  const strings = collectStrings(previews ?? {});
  const productionMarkers = [
    PRODUCTION_RESOURCE_MARKERS.d1Name,
    PRODUCTION_RESOURCE_MARKERS.r2Bucket,
    PRODUCTION_RESOURCE_MARKERS.queue,
    PRODUCTION_RESOURCE_MARKERS.rateLimiterNamespaceId,
  ];
  for (const marker of productionMarkers) {
    if (strings.includes(marker)) {
      fail(`previews block references production resource "${marker}"`);
    }
  }

  const previewVars = previews?.vars;
  if (previewVars?.WE_MET_ENV !== "preview") {
    fail('previews.vars.WE_MET_ENV must be "preview"');
  }
  if (previewVars?.WE_MET_ENV === "production") {
    fail("previews must not set WE_MET_ENV to production");
  }

  const previewD1 = previews?.d1_databases?.[0]?.database_name;
  const previewR2 = previews?.r2_buckets?.[0]?.bucket_name;
  const previewQueue = previews?.queues?.producers?.[0]?.queue;
  const previewRl = previews?.ratelimits?.[0]?.namespace_id;

  if (previewD1 !== NONPROD_RESOURCE_MARKERS.d1Name) fail("preview D1 binding name");
  if (previewR2 !== NONPROD_RESOURCE_MARKERS.r2Bucket) fail("preview R2 bucket");
  if (previewQueue !== NONPROD_RESOURCE_MARKERS.queue) fail("preview queue");
  if (previewRl !== NONPROD_RESOURCE_MARKERS.rateLimiterNamespaceId) {
    fail("preview rate limiter namespace");
  }
}

function checkProductionBlock(config) {
  if (config.name !== PRODUCTION_RESOURCE_MARKERS.workerName) {
    fail(`production Worker name must be "${PRODUCTION_RESOURCE_MARKERS.workerName}"`);
  }
  if (config.vars?.WE_MET_ENV !== "production") {
    fail('top-level WE_MET_ENV must be "production"');
  }
  const d1 = config.d1_databases?.[0]?.database_name;
  const r2 = config.r2_buckets?.[0]?.bucket_name;
  const queue = config.queues?.producers?.[0]?.queue;
  const rl = config.ratelimits?.[0]?.namespace_id;
  if (d1 !== PRODUCTION_RESOURCE_MARKERS.d1Name) fail("production D1 name");
  if (r2 !== PRODUCTION_RESOURCE_MARKERS.r2Bucket) fail("production R2 bucket");
  if (queue !== PRODUCTION_RESOURCE_MARKERS.queue) fail("production queue");
  if (rl !== PRODUCTION_RESOURCE_MARKERS.rateLimiterNamespaceId) {
    fail("production rate limiter namespace");
  }

  if (process.env.WE_MET_ENV === "production") {
    if (process.env.GITHUB_ENVIRONMENT !== "production") {
      fail(
        "WE_MET_ENV=production requires GitHub environment approval (GITHUB_ENVIRONMENT=production)",
      );
    }
  }
}

function main() {
  const { target, configPath } = parseArgs(process.argv.slice(2));
  const config = parseJsonc(readFileSync(configPath, "utf8"));

  checkNonprodMailSafety();

  if (target === "preview") {
    checkPreviewBlock(config.previews);
    console.log("deploy-time guards passed (preview)");
    return;
  }

  if (target === "production") {
    checkProductionBlock(config);
    checkPreviewBlock(config.previews);
    console.log("deploy-time guards passed (production)");
    return;
  }

  fail(`unknown --target ${target}`);
}

main();
