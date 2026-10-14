#!/usr/bin/env node
/**
 * Deploy-time guards from docs/architecture/environments.md#deploy-time-guards
 *
 * Usage:
 *   node scripts/check-deploy-guards.mjs --target preview --config wrangler.jsonc
 *   node scripts/check-deploy-guards.mjs --target production --config wrangler.jsonc
 *   node scripts/check-deploy-guards.mjs --target consumer-nonprod --config workers/we-met-followup-email-consumer/wrangler.nonprod.jsonc
 *   node scripts/check-deploy-guards.mjs --target consumer-production --config workers/we-met-followup-email-consumer/wrangler.production.jsonc
 *   node scripts/check-deploy-guards.mjs --mail-safety-config config/nonprod-mail-safety.json
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
    "Usage: check-deploy-guards.mjs --target <preview|production|consumer-nonprod|consumer-production> --config <path> [--mail-safety-config <path>]",
  );
  process.exit(1);
}

function parseArgs(argv) {
  let target = null;
  let configPath = resolve("wrangler.jsonc");
  let mailSafetyConfigPath = resolve("config/nonprod-mail-safety.json");
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--target") target = argv[++i];
    else if (arg === "--config") configPath = resolve(argv[++i]);
    else if (arg === "--mail-safety-config") mailSafetyConfigPath = resolve(argv[++i]);
    else if (arg === "--help" || arg === "-h") usage();
    else {
      console.error(`Unknown argument: ${arg}`);
      usage();
    }
  }
  if (!target) usage();
  return { target, configPath, mailSafetyConfigPath };
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

// Validates nonprod mail safety spec only until the consumer Worker ships (DIDI-577).
function checkNonprodMailSafety(mailSafetyConfigPath) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(mailSafetyConfigPath, "utf8"));
  } catch {
    fail(`missing or invalid ${mailSafetyConfigPath}`);
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

function assertEveryPreviewD1(previews, predicate, message) {
  const rows = previews?.d1_databases ?? [];
  if (rows.length === 0) fail("previews.d1_databases is required");
  for (const row of rows) {
    if (!predicate(row)) fail(message);
  }
}

function assertEveryPreviewR2(previews, predicate, message) {
  const rows = previews?.r2_buckets ?? [];
  if (rows.length === 0) fail("previews.r2_buckets is required");
  for (const row of rows) {
    if (!predicate(row)) fail(message);
  }
}

function assertEveryPreviewQueue(previews, predicate, message) {
  const producers = previews?.queues?.producers ?? [];
  if (producers.length === 0) fail("previews.queues.producers is required");
  for (const row of producers) {
    if (!predicate(row)) fail(message);
  }
}

function assertEveryPreviewRateLimit(previews, predicate, message) {
  const rows = previews?.ratelimits ?? [];
  if (rows.length === 0) fail("previews.ratelimits is required");
  for (const row of rows) {
    if (!predicate(row)) fail(message);
  }
}

function checkWranglerDomainSettings(config) {
  if (config.preview_urls !== true) {
    fail(
      "preview_urls must be true (CI preview URL comment and non-prod Turnstile require workers.dev preview URLs)",
    );
  }
  if (config.workers_dev !== false) {
    fail(
      "workers_dev must be false (production serves we-met.link only; preview URLs use preview_urls)",
    );
  }
}

function checkDistinctD1Ids(config) {
  const topLevelIds = (config.d1_databases ?? [])
    .map((row) => row.database_id)
    .filter(Boolean);
  const previewIds = (config.previews?.d1_databases ?? [])
    .map((row) => row.database_id)
    .filter(Boolean);
  for (const topId of topLevelIds) {
    for (const previewId of previewIds) {
      if (topId === previewId) {
        fail(
          "previews D1 database_id must differ from top-level production database_id",
        );
      }
    }
  }
  const seen = new Set();
  for (const id of [...topLevelIds, ...previewIds]) {
    if (seen.has(id)) {
      fail("duplicate D1 database_id across top-level and previews blocks");
    }
    seen.add(id);
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

  const previewHostSuffix = previewVars?.WE_MET_PREVIEW_HOST_SUFFIX ?? "";
  if (!previewHostSuffix.trim()) {
    fail("previews.vars.WE_MET_PREVIEW_HOST_SUFFIX must be non-empty");
  }
  if (!previewHostSuffix.startsWith("-we-met.")) {
    fail('previews.vars.WE_MET_PREVIEW_HOST_SUFFIX must start with "-we-met."');
  }

  assertEveryPreviewD1(
    previews,
    (row) => row.database_name === NONPROD_RESOURCE_MARKERS.d1Name,
    "preview D1 binding name",
  );
  assertEveryPreviewR2(
    previews,
    (row) => row.bucket_name === NONPROD_RESOURCE_MARKERS.r2Bucket,
    "preview R2 bucket",
  );
  assertEveryPreviewQueue(
    previews,
    (row) => row.queue === NONPROD_RESOURCE_MARKERS.queue,
    "preview queue",
  );
  assertEveryPreviewRateLimit(
    previews,
    (row) => row.namespace_id === NONPROD_RESOURCE_MARKERS.rateLimiterNamespaceId,
    "preview rate limiter namespace",
  );
}

const ALLOWED_CONSUMER_VAR_KEYS = new Set(["WE_MET_ENV"]);

function checkConsumerVarsAllowlist(config) {
  const vars = config.vars ?? {};
  for (const key of Object.keys(vars)) {
    if (!ALLOWED_CONSUMER_VAR_KEYS.has(key)) {
      fail(
        `consumer vars may only contain ${[...ALLOWED_CONSUMER_VAR_KEYS].join(", ")}; found "${key}"`,
      );
    }
  }
  if (Object.prototype.hasOwnProperty.call(vars, "WE_MET_TEST_MAIL_TO")) {
    fail(
      "non-prod consumer must not declare WE_MET_TEST_MAIL_TO in wrangler vars (secret only)",
    );
  }
}

function checkConsumerNonprod(config) {
  checkConsumerVarsAllowlist(config);
  if (config.name !== NONPROD_RESOURCE_MARKERS.consumerWorkerName) {
    fail(
      `non-prod consumer Worker name must be "${NONPROD_RESOURCE_MARKERS.consumerWorkerName}"`,
    );
  }
  if (config.vars?.WE_MET_ENV === "production") {
    fail("non-prod consumer WE_MET_ENV must not be production");
  }
  const strings = collectStrings(config);
  for (const marker of [
    PRODUCTION_RESOURCE_MARKERS.queue,
    PRODUCTION_RESOURCE_MARKERS.r2Bucket,
    PRODUCTION_RESOURCE_MARKERS.d1Name,
  ]) {
    if (strings.includes(marker)) {
      fail(`non-prod consumer config references production resource "${marker}"`);
    }
  }
  const consumers = config.queues?.consumers ?? [];
  if (consumers.length !== 1 || consumers[0].queue !== NONPROD_RESOURCE_MARKERS.queue) {
    fail("non-prod consumer must consume we-met-followup-email-nonprod only");
  }
  const buckets = config.r2_buckets ?? [];
  if (
    buckets.length !== 1 ||
    buckets[0].bucket_name !== NONPROD_RESOURCE_MARKERS.r2Bucket
  ) {
    fail("non-prod consumer R2 bucket binding");
  }
  if (consumers[0].max_retries !== 5) {
    fail("non-prod consumer max_retries must be 5");
  }
  if ((config.d1_databases ?? []).length > 0) {
    fail("consumer Worker must not bind D1");
  }
}

function checkConsumerProduction(config) {
  checkConsumerVarsAllowlist(config);
  if (config.name !== "we-met-followup-email-consumer") {
    fail('production consumer Worker name must be "we-met-followup-email-consumer"');
  }
  if (config.vars?.WE_MET_ENV !== "production") {
    fail('production consumer WE_MET_ENV must be "production"');
  }
  const strings = collectStrings(config);
  if (strings.some((s) => s.includes("WE_MET_TEST_MAIL_TO"))) {
    fail("production consumer must not reference WE_MET_TEST_MAIL_TO");
  }
  for (const marker of [
    NONPROD_RESOURCE_MARKERS.queue,
    NONPROD_RESOURCE_MARKERS.r2Bucket,
    NONPROD_RESOURCE_MARKERS.d1Name,
  ]) {
    if (strings.includes(marker)) {
      fail(`production consumer config references non-prod resource "${marker}"`);
    }
  }
  const consumers = config.queues?.consumers ?? [];
  if (
    consumers.length !== 1 ||
    consumers[0].queue !== PRODUCTION_RESOURCE_MARKERS.queue
  ) {
    fail("production consumer must consume we-met-followup-email only");
  }
  const buckets = config.r2_buckets ?? [];
  if (
    buckets.length !== 1 ||
    buckets[0].bucket_name !== PRODUCTION_RESOURCE_MARKERS.r2Bucket
  ) {
    fail("production consumer R2 bucket binding");
  }
  if (consumers[0].max_retries !== 5) {
    fail("production consumer max_retries must be 5");
  }
  if ((config.d1_databases ?? []).length > 0) {
    fail("consumer Worker must not bind D1");
  }
}

function checkProductionBlock(config) {
  if (config.name !== PRODUCTION_RESOURCE_MARKERS.workerName) {
    fail(`production Worker name must be "${PRODUCTION_RESOURCE_MARKERS.workerName}"`);
  }
  if (config.vars?.WE_MET_ENV !== "production") {
    fail('top-level WE_MET_ENV must be "production"');
  }

  const productionHostSuffix = config.vars?.WE_MET_PREVIEW_HOST_SUFFIX ?? "";
  if (productionHostSuffix !== "") {
    fail(
      'top-level vars.WE_MET_PREVIEW_HOST_SUFFIX must be "" (preview suffix lives in previews.vars only)',
    );
  }

  const d1Rows = config.d1_databases ?? [];
  const r2Rows = config.r2_buckets ?? [];
  const queueRows = config.queues?.producers ?? [];
  const rlRows = config.ratelimits ?? [];

  if (d1Rows.length === 0) fail("production d1_databases is required");
  if (r2Rows.length === 0) fail("production r2_buckets is required");
  if (queueRows.length === 0) fail("production queues.producers is required");
  if (rlRows.length === 0) fail("production ratelimits is required");

  for (const row of d1Rows) {
    if (row.database_name !== PRODUCTION_RESOURCE_MARKERS.d1Name) {
      fail("production D1 name");
    }
  }
  for (const row of r2Rows) {
    if (row.bucket_name !== PRODUCTION_RESOURCE_MARKERS.r2Bucket) {
      fail("production R2 bucket");
    }
  }
  for (const row of queueRows) {
    if (row.queue !== PRODUCTION_RESOURCE_MARKERS.queue) {
      fail("production queue");
    }
  }
  for (const row of rlRows) {
    if (row.namespace_id !== PRODUCTION_RESOURCE_MARKERS.rateLimiterNamespaceId) {
      fail("production rate limiter namespace");
    }
  }
}

function main() {
  const { target, configPath, mailSafetyConfigPath } = parseArgs(process.argv.slice(2));
  const config = parseJsonc(readFileSync(configPath, "utf8"));

  checkNonprodMailSafety(mailSafetyConfigPath);

  const isConsumerTarget =
    target === "consumer-nonprod" || target === "consumer-production";
  if (!isConsumerTarget) {
    checkWranglerDomainSettings(config);
    checkDistinctD1Ids(config);
  }

  if (target === "preview") {
    checkPreviewBlock(config.previews);
    console.log("deploy-time guards passed (preview)");
    return;
  }

  if (target === "consumer-nonprod") {
    checkConsumerNonprod(config);
    console.log("deploy-time guards passed (consumer-nonprod)");
    return;
  }

  if (target === "consumer-production") {
    checkConsumerProduction(config);
    console.log("deploy-time guards passed (consumer-production)");
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
