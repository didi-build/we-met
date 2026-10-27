#!/usr/bin/env node
/**
 * Deploy-time guards from docs/architecture/environments.md#deploy-time-guards
 *
 * Usage:
 *   node scripts/check-deploy-guards.mjs --target preview --config wrangler.jsonc
 *   node scripts/check-deploy-guards.mjs --target preview-worker --config wrangler.preview.jsonc
 *   node scripts/check-deploy-guards.mjs --target production --config wrangler.jsonc
 *   node scripts/check-deploy-guards.mjs --target consumer-nonprod --config workers/we-met-followup-email-consumer/wrangler.nonprod.jsonc
 *   node scripts/check-deploy-guards.mjs --target consumer-production --config workers/we-met-followup-email-consumer/wrangler.production.jsonc
 *   node scripts/check-deploy-guards.mjs --target staging --config wrangler.staging.jsonc
 *   node scripts/check-deploy-guards.mjs --target warmup-production --config workers/warmup/wrangler.jsonc
 *   node scripts/check-deploy-guards.mjs --mail-safety-config config/nonprod-mail-safety.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseJsonc } from "./lib/parse-jsonc.mjs";
import {
  FOLLOWUP_RETRY_BASE_DELAY_SECONDS,
  followupRetryWindowFitsBudget,
  MAX_VISITOR_FOLLOWUP_ATTEMPTS,
} from "./lib/queue-retry-policy.mjs";
import {
  D1_PLACEHOLDER_NONPROD,
  D1_PLACEHOLDER_PRODUCTION,
  NONPROD_RESOURCE_MARKERS,
  PRODUCTION_APP_HOST,
  PRODUCTION_RESOURCE_MARKERS,
  STAGING_RESOURCE_MARKERS,
  RATE_LIMIT_BINDINGS,
  WARMUP_KV_PLACEHOLDER_ID,
  WARMUP_EMAIL_EVENTS_DLQ,
  WARMUP_EMAIL_EVENTS_DLQ_PLACEHOLDER,
  WARMUP_EMAIL_EVENTS_QUEUE,
  WARMUP_EMAIL_EVENTS_QUEUE_PLACEHOLDER,
} from "./lib/wrangler-placeholders.mjs";

const STAGING_VARS_ALLOWLIST = new Set([
  "WE_MET_BASE_URL",
  "WE_MET_ENV",
  "WE_MET_PREVIEW_HOST_SUFFIX",
  "WE_MET_CONTACT_SENDER_ADDRESSES",
  "CONTACTS_SETUP_ENABLED_FOR_ALL",
]);
const STAGING_WORKER_SELF_REFERENCE_BINDING = "WORKER_SELF_REFERENCE";

const WARMUP_WORKER_NAME = "we-met-warmup-cron";
const WARMUP_RETRY_QUEUE = "we-met-warmup-send-retry";
const WARMUP_DLQ = "we-met-warmup-send-dlq";
const WARMUP_STATE_BINDING = "WARMUP_STATE";
const WARMUP_EMAIL_EVENTS_MAX_RETRIES = 3;
const WARMUP_EMAIL_EVENTS_MAX_BATCH_SIZE = 10;
import { previewLoginReachableForWorkerEnv } from "./lib/preview-login-guard.mjs";

function usage() {
  console.error(
    "Usage: check-deploy-guards.mjs --target <preview|preview-worker|production|staging|staging-build|consumer-nonprod|consumer-production|warmup-production> --config <path> [--mail-safety-config <path>]",
  );
  process.exit(1);
}

function checkStagingBuildEnvironment() {
  const env = process.env.WE_MET_ENV?.trim();
  if (env !== "staging") {
    fail('staging build requires WE_MET_ENV "staging"');
  }
  const baseUrl = process.env.WE_MET_BASE_URL?.trim();
  if (baseUrl !== STAGING_RESOURCE_MARKERS.baseUrl) {
    fail(
      `staging build requires WE_MET_BASE_URL "${STAGING_RESOURCE_MARKERS.baseUrl}"`,
    );
  }
  const previewSuffix = process.env.WE_MET_PREVIEW_HOST_SUFFIX?.trim() ?? "";
  if (previewSuffix !== "") {
    fail('staging build requires WE_MET_PREVIEW_HOST_SUFFIX to be unset or ""');
  }
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

function expectedRateLimitNamespace(bindingName, isProduction) {
  const markers = isProduction ? PRODUCTION_RESOURCE_MARKERS : NONPROD_RESOURCE_MARKERS;
  switch (bindingName) {
    case RATE_LIMIT_BINDINGS.exchange:
      return markers.exchangeRateLimiterNamespaceId;
    case RATE_LIMIT_BINDINGS.auth:
      return markers.authRateLimiterNamespaceId;
    case RATE_LIMIT_BINDINGS.app:
      return markers.appRateLimiterNamespaceId;
    default:
      return null;
  }
}

function checkRateLimitBindings(ratelimits, isProduction) {
  const rows = ratelimits ?? [];
  const required = [
    RATE_LIMIT_BINDINGS.exchange,
    RATE_LIMIT_BINDINGS.auth,
    RATE_LIMIT_BINDINGS.app,
  ];
  if (rows.length < required.length) {
    fail(
      `${isProduction ? "production" : "preview"} ratelimits must include exchange, auth, and app bindings`,
    );
  }
  for (const bindingName of required) {
    const row = rows.find((entry) => entry.name === bindingName);
    if (!row) {
      fail(
        `${isProduction ? "production" : "preview"} missing rate limit binding ${bindingName}`,
      );
    }
    const expected = expectedRateLimitNamespace(bindingName, isProduction);
    if (row.namespace_id !== expected) {
      fail(
        `${isProduction ? "production" : "preview"} rate limiter namespace for ${bindingName}`,
      );
    }
  }
  const productionMarkers = [
    PRODUCTION_RESOURCE_MARKERS.exchangeRateLimiterNamespaceId,
    PRODUCTION_RESOURCE_MARKERS.authRateLimiterNamespaceId,
    PRODUCTION_RESOURCE_MARKERS.appRateLimiterNamespaceId,
  ];
  if (!isProduction) {
    for (const row of rows) {
      if (productionMarkers.includes(row.namespace_id)) {
        fail("preview rate limiter namespace must not use production namespace ids");
      }
    }
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

function expectedNonprodStorageName(productionName) {
  return `${productionName}-nonprod`;
}

function checkProdPreviewD1R2BindingPairs(config) {
  const prodD1 = config.d1_databases ?? [];
  const previewD1 = config.previews?.d1_databases ?? [];
  const prodR2 = config.r2_buckets ?? [];
  const previewR2 = config.previews?.r2_buckets ?? [];

  for (const prod of prodD1) {
    const binding = prod.binding;
    if (!binding) fail("production D1 binding name is required");
    const prodName = prod.database_name;
    if (typeof prodName !== "string" || !prodName.trim()) {
      fail(`production D1 binding "${binding}" database_name is required`);
    }
    const preview = previewD1.find((row) => row.binding === binding);
    if (!preview) {
      fail(`previews missing D1 binding "${binding}" (paired with production)`);
    }
    const expectedName = expectedNonprodStorageName(prodName);
    if (preview.database_name !== expectedName) {
      fail(`previews D1 binding "${binding}" must use database_name "${expectedName}"`);
    }
  }

  for (const preview of previewD1) {
    const binding = preview.binding;
    if (!binding) fail("previews D1 binding name is required");
    const previewName = preview.database_name;
    if (typeof previewName !== "string" || !previewName.trim()) {
      fail(`previews D1 binding "${binding}" database_name is required`);
    }
    const prod = prodD1.find((row) => row.binding === binding);
    if (!prod) {
      fail(`production missing D1 binding "${binding}" (paired with previews)`);
    }
    if (!previewName.endsWith("-nonprod")) {
      fail(`previews D1 binding "${binding}" database_name must end with "-nonprod"`);
    }
    const expectedProd = previewName.slice(0, -"-nonprod".length);
    if (prod.database_name !== expectedProd) {
      fail(
        `production D1 binding "${binding}" must use database_name "${expectedProd}"`,
      );
    }
  }

  for (const prod of prodR2) {
    const binding = prod.binding;
    if (!binding) fail("production R2 binding name is required");
    const prodBucket = prod.bucket_name;
    if (typeof prodBucket !== "string" || !prodBucket.trim()) {
      fail(`production R2 binding "${binding}" bucket_name is required`);
    }
    const preview = previewR2.find((row) => row.binding === binding);
    if (!preview) {
      fail(`previews missing R2 binding "${binding}" (paired with production)`);
    }
    const expectedName = expectedNonprodStorageName(prodBucket);
    if (preview.bucket_name !== expectedName) {
      fail(`previews R2 binding "${binding}" must use bucket_name "${expectedName}"`);
    }
  }

  for (const preview of previewR2) {
    const binding = preview.binding;
    if (!binding) fail("previews R2 binding name is required");
    const previewBucket = preview.bucket_name;
    if (typeof previewBucket !== "string" || !previewBucket.trim()) {
      fail(`previews R2 binding "${binding}" bucket_name is required`);
    }
    const prod = prodR2.find((row) => row.binding === binding);
    if (!prod) {
      fail(`production missing R2 binding "${binding}" (paired with previews)`);
    }
    if (!previewBucket.endsWith("-nonprod")) {
      fail(`previews R2 binding "${binding}" bucket_name must end with "-nonprod"`);
    }
    const expectedProd = previewBucket.slice(0, -"-nonprod".length);
    if (prod.bucket_name !== expectedProd) {
      fail(`production R2 binding "${binding}" must use bucket_name "${expectedProd}"`);
    }
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

function routePatterns(config) {
  return (config.routes ?? [])
    .map((row) => row?.pattern)
    .filter((pattern) => typeof pattern === "string");
}

function checkProductionAppHostRoute(config) {
  const patterns = routePatterns(config);
  if (!patterns.includes(PRODUCTION_APP_HOST)) {
    fail(`production routes must include custom domain ${PRODUCTION_APP_HOST}`);
  }
}

function checkPreviewBlockNoAppHostRoute(previews) {
  const patterns = routePatterns(previews ?? {});
  if (patterns.includes(PRODUCTION_APP_HOST)) {
    fail(`previews.routes must not include production app host ${PRODUCTION_APP_HOST}`);
  }
}

function checkPreviewResourceBindings(previews) {
  checkPreviewBlockNoAppHostRoute(previews);
  const strings = collectStrings(previews ?? {});
  const productionMarkers = [
    PRODUCTION_RESOURCE_MARKERS.d1Name,
    PRODUCTION_RESOURCE_MARKERS.r2Bucket,
    PRODUCTION_RESOURCE_MARKERS.queue,
    PRODUCTION_RESOURCE_MARKERS.exchangeRateLimiterNamespaceId,
    PRODUCTION_RESOURCE_MARKERS.authRateLimiterNamespaceId,
    PRODUCTION_RESOURCE_MARKERS.appRateLimiterNamespaceId,
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

  const previewBaseUrl = previewVars?.WE_MET_BASE_URL;
  if (previewBaseUrl !== NONPROD_RESOURCE_MARKERS.baseUrl) {
    fail(`previews.vars.WE_MET_BASE_URL must be "${NONPROD_RESOURCE_MARKERS.baseUrl}"`);
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
  checkRateLimitBindings(previews?.ratelimits, false);
}

function assertNestedPreviewHostSuffix(previewVars) {
  const previewHostSuffix = previewVars?.WE_MET_PREVIEW_HOST_SUFFIX ?? "";
  if (!previewHostSuffix.trim()) {
    fail("previews.vars.WE_MET_PREVIEW_HOST_SUFFIX must be non-empty");
  }
  if (!previewHostSuffix.startsWith("-we-met.")) {
    fail('previews.vars.WE_MET_PREVIEW_HOST_SUFFIX must start with "-we-met."');
  }
}

function assertPreviewWorkerHostSuffix(previewVars) {
  const previewHostSuffix = previewVars?.WE_MET_PREVIEW_HOST_SUFFIX ?? "";
  if (!previewHostSuffix.trim()) {
    fail(`${PREVIEW_CONFIG_LABEL} vars.WE_MET_PREVIEW_HOST_SUFFIX must be non-empty`);
  }
  if (!previewHostSuffix.startsWith("-we-met-preview.")) {
    fail(
      `${PREVIEW_CONFIG_LABEL} vars.WE_MET_PREVIEW_HOST_SUFFIX must start with "-we-met-preview."`,
    );
  }
}

function checkPreviewBlock(previews) {
  checkPreviewResourceBindings(previews);
  assertNestedPreviewHostSuffix(previews?.vars);
}

const PREVIEW_WORKER_NAME = "we-met-preview";
const PREVIEW_CONFIG_LABEL = "wrangler.preview.jsonc";

function checkPreviewWorkerDomainSettings(config) {
  if (config.workers_dev !== true) {
    fail(`${PREVIEW_CONFIG_LABEL} workers_dev must be true`);
  }
  if (config.preview_urls !== true) {
    fail(`${PREVIEW_CONFIG_LABEL} preview_urls must be true`);
  }
  const patterns = routePatterns(config);
  if (patterns.length > 0) {
    fail(`${PREVIEW_CONFIG_LABEL} must not define routes or custom domains`);
  }
}

function checkPreviewWorkerNoProductionServiceBinding(config) {
  const services = config.services ?? [];
  for (const row of services) {
    const service = row?.service;
    if (service === "we-met") {
      fail(`${PREVIEW_CONFIG_LABEL} must not service-bind to production Worker we-met`);
    }
    if (service && service !== PREVIEW_WORKER_NAME) {
      fail(
        `${PREVIEW_CONFIG_LABEL} service binding must target ${PREVIEW_WORKER_NAME} only`,
      );
    }
  }
}

function checkPreviewWorkerBlock(config) {
  if (config.name !== PREVIEW_WORKER_NAME) {
    fail(`${PREVIEW_CONFIG_LABEL} name must be "${PREVIEW_WORKER_NAME}"`);
  }
  checkPreviewWorkerDomainSettings(config);
  checkPreviewWorkerNoProductionServiceBinding(config);
  checkPreviewResourceBindings({
    vars: config.vars,
    d1_databases: config.d1_databases,
    r2_buckets: config.r2_buckets,
    queues: config.queues,
    ratelimits: config.ratelimits,
    routes: config.routes,
  });
  assertPreviewWorkerHostSuffix(config.vars);
  const topD1 = config.d1_databases ?? [];
  for (const row of topD1) {
    if (row.database_id === D1_PLACEHOLDER_PRODUCTION) {
      fail(`${PREVIEW_CONFIG_LABEL} must not use production D1 placeholder id`);
    }
  }
}

const ALLOWED_CONSUMER_VAR_KEYS = new Set(["WE_MET_ENV", "WE_MET_BASE_URL"]);
const CONSUMER_D1_BINDING = "WE_MET_DB";

function checkConsumerQueueConsumerSettings(consumerRow) {
  if (consumerRow.dead_letter_queue) {
    fail("consumer must not configure dead_letter_queue");
  }
  if (consumerRow.max_retries !== MAX_VISITOR_FOLLOWUP_ATTEMPTS) {
    fail(
      `consumer max_retries must be ${MAX_VISITOR_FOLLOWUP_ATTEMPTS} (matches code attempt limit)`,
    );
  }
  if (consumerRow.retry_delay !== FOLLOWUP_RETRY_BASE_DELAY_SECONDS) {
    fail(
      `consumer retry_delay must be ${FOLLOWUP_RETRY_BASE_DELAY_SECONDS} (matches code base delay)`,
    );
  }
  if (!followupRetryWindowFitsBudget()) {
    fail("consumer retry window exceeds retention budget");
  }
}

function checkConsumerPublicUrlSettings(config) {
  if (config.workers_dev !== false) {
    fail("consumer workers_dev must be false (no public workers.dev route)");
  }
  if (config.preview_urls !== false) {
    fail(
      "consumer preview_urls must be false (no Version URLs on follow-up consumers)",
    );
  }
}

function checkConsumerD1Binding(config, expectedDatabaseName) {
  const rows = config.d1_databases ?? [];
  if (rows.length !== 1) {
    fail("consumer must bind exactly one D1 database");
  }
  const row = rows[0];
  if (row.binding !== CONSUMER_D1_BINDING) {
    fail(`consumer D1 binding must be "${CONSUMER_D1_BINDING}"`);
  }
  if (row.database_name !== expectedDatabaseName) {
    fail(`consumer D1 database_name must be "${expectedDatabaseName}"`);
  }
}

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
  checkConsumerPublicUrlSettings(config);
  checkConsumerVarsAllowlist(config);
  if (config.name !== NONPROD_RESOURCE_MARKERS.consumerWorkerName) {
    fail(
      `non-prod consumer Worker name must be "${NONPROD_RESOURCE_MARKERS.consumerWorkerName}"`,
    );
  }
  const consumerWeMetEnv = config.vars?.WE_MET_ENV;
  if (
    typeof consumerWeMetEnv !== "string" ||
    consumerWeMetEnv.trim() === "" ||
    consumerWeMetEnv.trim() === "production"
  ) {
    fail("non-prod consumer vars.WE_MET_ENV must be a non-empty non-production value");
  }
  const nonprodBaseUrl = config.vars?.WE_MET_BASE_URL;
  if (nonprodBaseUrl !== NONPROD_RESOURCE_MARKERS.baseUrl) {
    fail(
      `non-prod consumer vars.WE_MET_BASE_URL must be "${NONPROD_RESOURCE_MARKERS.baseUrl}"`,
    );
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
  checkConsumerQueueConsumerSettings(consumers[0]);
  const buckets = config.r2_buckets ?? [];
  if (
    buckets.length !== 1 ||
    buckets[0].bucket_name !== NONPROD_RESOURCE_MARKERS.r2Bucket
  ) {
    fail("non-prod consumer R2 bucket binding");
  }
  checkConsumerD1Binding(config, NONPROD_RESOURCE_MARKERS.d1Name);
}

function checkWarmupProduction(config) {
  checkConsumerPublicUrlSettings(config);
  if (config.name !== WARMUP_WORKER_NAME) {
    fail(`warmup Worker name must be "${WARMUP_WORKER_NAME}"`);
  }
  const kvRows = config.kv_namespaces ?? [];
  const warmupKv = kvRows.find((row) => row.binding === WARMUP_STATE_BINDING);
  if (!warmupKv) {
    fail(`warmup must bind KV namespace "${WARMUP_STATE_BINDING}"`);
  }
  const kvId = typeof warmupKv.id === "string" ? warmupKv.id.trim() : "";
  if (!kvId || kvId === WARMUP_KV_PLACEHOLDER_ID) {
    fail(
      "warmup WARMUP_STATE namespace id must be set to the production KV namespace (not the zero placeholder)",
    );
  }
  const producers = config.queues?.producers ?? [];
  const producerQueues = producers.map((row) => row.queue).filter(Boolean);
  if (!producerQueues.includes(WARMUP_RETRY_QUEUE)) {
    fail(`warmup must declare queue producer "${WARMUP_RETRY_QUEUE}"`);
  }
  if (!producerQueues.includes(WARMUP_DLQ)) {
    fail(`warmup must declare queue producer "${WARMUP_DLQ}"`);
  }
  const consumers = config.queues?.consumers ?? [];
  if (consumers.length !== 2) {
    fail(
      "warmup must declare exactly two queue consumers (send-retry and email-events)",
    );
  }
  const retryConsumer = consumers.find((row) => row.queue === WARMUP_RETRY_QUEUE);
  if (!retryConsumer || retryConsumer.dead_letter_queue !== WARMUP_DLQ) {
    fail(
      `warmup queue consumer must consume "${WARMUP_RETRY_QUEUE}" with dead_letter_queue "${WARMUP_DLQ}"`,
    );
  }
  const emailEventsConsumer = consumers.find(
    (row) =>
      row.queue === WARMUP_EMAIL_EVENTS_QUEUE ||
      row.queue === WARMUP_EMAIL_EVENTS_QUEUE_PLACEHOLDER,
  );
  if (!emailEventsConsumer) {
    fail(`warmup must declare a queue consumer for "${WARMUP_EMAIL_EVENTS_QUEUE}"`);
  }
  const emailEventsQueue =
    typeof emailEventsConsumer.queue === "string"
      ? emailEventsConsumer.queue.trim()
      : "";
  if (!emailEventsQueue || emailEventsQueue === WARMUP_EMAIL_EVENTS_QUEUE_PLACEHOLDER) {
    fail(
      `warmup email-events consumer queue must be set to "${WARMUP_EMAIL_EVENTS_QUEUE}" (not the placeholder id)`,
    );
  }
  if (emailEventsQueue !== WARMUP_EMAIL_EVENTS_QUEUE) {
    fail(`warmup email-events consumer queue must be "${WARMUP_EMAIL_EVENTS_QUEUE}"`);
  }
  const emailEventsDlq =
    typeof emailEventsConsumer.dead_letter_queue === "string"
      ? emailEventsConsumer.dead_letter_queue.trim()
      : "";
  if (!emailEventsDlq || emailEventsDlq === WARMUP_EMAIL_EVENTS_DLQ_PLACEHOLDER) {
    fail(
      `warmup email-events dead_letter_queue must be set to "${WARMUP_EMAIL_EVENTS_DLQ}" (not the placeholder id)`,
    );
  }
  if (emailEventsDlq !== WARMUP_EMAIL_EVENTS_DLQ) {
    fail(`warmup email-events dead_letter_queue must be "${WARMUP_EMAIL_EVENTS_DLQ}"`);
  }
  if (emailEventsConsumer.max_retries !== WARMUP_EMAIL_EVENTS_MAX_RETRIES) {
    fail(
      `warmup email-events consumer max_retries must be ${WARMUP_EMAIL_EVENTS_MAX_RETRIES}`,
    );
  }
  if (emailEventsConsumer.max_batch_size !== WARMUP_EMAIL_EVENTS_MAX_BATCH_SIZE) {
    fail(
      `warmup email-events consumer max_batch_size must be ${WARMUP_EMAIL_EVENTS_MAX_BATCH_SIZE}`,
    );
  }
}

function checkConsumerProduction(config) {
  checkConsumerPublicUrlSettings(config);
  checkConsumerVarsAllowlist(config);
  if (config.name !== "we-met-followup-email-consumer") {
    fail('production consumer Worker name must be "we-met-followup-email-consumer"');
  }
  if (config.vars?.WE_MET_ENV !== "production") {
    fail('production consumer WE_MET_ENV must be "production"');
  }
  const productionBaseUrl = config.vars?.WE_MET_BASE_URL;
  if (productionBaseUrl !== PRODUCTION_RESOURCE_MARKERS.baseUrl) {
    fail(
      `production consumer vars.WE_MET_BASE_URL must be "${PRODUCTION_RESOURCE_MARKERS.baseUrl}"`,
    );
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
  checkConsumerQueueConsumerSettings(consumers[0]);
  const buckets = config.r2_buckets ?? [];
  if (
    buckets.length !== 1 ||
    buckets[0].bucket_name !== PRODUCTION_RESOURCE_MARKERS.r2Bucket
  ) {
    fail("production consumer R2 bucket binding");
  }
  checkConsumerD1Binding(config, PRODUCTION_RESOURCE_MARKERS.d1Name);
}

function checkStagingPublicUrlSettings(config) {
  if (config.workers_dev !== false) {
    fail("staging workers_dev must be false");
  }
  if (config.preview_urls !== false) {
    fail("staging preview_urls must be false");
  }
}

function checkStagingRoutes(config) {
  const routes = config.routes ?? [];
  const allowed = STAGING_RESOURCE_MARKERS.hostname;
  if (routes.length !== 1) {
    fail(`staging routes must be only custom domain ${allowed}`);
  }
  const row = routes[0];
  const pattern = row?.pattern;
  if (typeof pattern !== "string" || pattern !== allowed) {
    fail(`staging routes must be only custom domain ${allowed}`);
  }
  if (row.custom_domain !== true) {
    fail("staging route must set custom_domain true");
  }
  if (pattern === "we-met.link" || pattern === PRODUCTION_APP_HOST) {
    fail(`staging routes must not include ${pattern}`);
  }
}

function checkStagingVarsAllowlist(config) {
  const vars = config.vars ?? {};
  for (const key of Object.keys(vars)) {
    if (!STAGING_VARS_ALLOWLIST.has(key)) {
      fail(
        `staging vars may only contain ${[...STAGING_VARS_ALLOWLIST].join(", ")}; found "${key}"`,
      );
    }
  }
}

function checkStagingWorkerSelfReference(config) {
  const rows = config.services ?? [];
  if (rows.length !== 1) {
    fail("staging must declare exactly one services binding");
  }
  const row = rows[0];
  if (row.binding !== STAGING_WORKER_SELF_REFERENCE_BINDING) {
    fail(`staging services binding must be "${STAGING_WORKER_SELF_REFERENCE_BINDING}"`);
  }
  if (row.service !== STAGING_RESOURCE_MARKERS.workerName) {
    fail(
      `staging WORKER_SELF_REFERENCE must target "${STAGING_RESOURCE_MARKERS.workerName}"`,
    );
  }
}

function stagingBindsDurableObjects(config) {
  const raw = config.durable_objects;
  if (raw == null) {
    return false;
  }
  if (Array.isArray(raw)) {
    return raw.length > 0;
  }
  if (typeof raw === "object" && Array.isArray(raw.bindings)) {
    return raw.bindings.length > 0;
  }
  return true;
}

function checkStagingForbiddenTopLevel(config) {
  if (Object.prototype.hasOwnProperty.call(config, "route")) {
    fail("staging config must use routes array, not singular route");
  }
  if (config.env && typeof config.env === "object") {
    fail("staging config must not define env blocks");
  }
  if ((config.kv_namespaces ?? []).length > 0) {
    fail("staging must not bind kv_namespaces");
  }
  if (stagingBindsDurableObjects(config)) {
    fail("staging must not bind durable_objects");
  }
}

function checkStagingD1Id(config) {
  const rows = config.d1_databases ?? [];
  if (rows.length !== 1) {
    fail("staging must bind exactly one D1 database");
  }
  const id = rows[0].database_id;
  if (!id || typeof id !== "string") {
    fail("staging D1 database_id is required");
  }
  const productionId = process.env.WE_MET_D1_DATABASE_ID_PRODUCTION?.trim();
  const nonprodId = process.env.WE_MET_D1_DATABASE_ID_NONPROD?.trim();
  if (productionId && id === productionId) {
    fail("staging D1 database_id must not equal production database_id");
  }
  if (id === D1_PLACEHOLDER_PRODUCTION) {
    fail("staging D1 database_id must not use production placeholder");
  }
  if (nonprodId) {
    if (id !== nonprodId) {
      fail("staging D1 database_id must match non-prod database_id");
    }
    return;
  }
  if (id !== D1_PLACEHOLDER_NONPROD) {
    fail("staging D1 database_id must use non-prod placeholder");
  }
}

function checkStagingBlock(config) {
  checkStagingPublicUrlSettings(config);
  checkStagingForbiddenTopLevel(config);
  if (config.previews) {
    fail("staging config must not include a previews block");
  }
  if (config.name !== STAGING_RESOURCE_MARKERS.workerName) {
    fail(`staging Worker name must be "${STAGING_RESOURCE_MARKERS.workerName}"`);
  }
  if (
    Object.prototype.hasOwnProperty.call(
      config.vars ?? {},
      "WE_MET_PREVIEW_LOGIN_SECRET",
    )
  ) {
    fail("staging vars must not include WE_MET_PREVIEW_LOGIN_SECRET");
  }
  if (
    Object.prototype.hasOwnProperty.call(
      config.vars ?? {},
      "WE_MET_PREVIEW_LOGIN_EMAIL",
    )
  ) {
    fail("staging vars must not include WE_MET_PREVIEW_LOGIN_EMAIL");
  }
  checkStagingVarsAllowlist(config);
  if (config.vars?.CONTACTS_SETUP_ENABLED_FOR_ALL !== "false") {
    fail('staging vars.CONTACTS_SETUP_ENABLED_FOR_ALL must be "false"');
  }
  const stagingEnv = config.vars?.WE_MET_ENV;
  if (stagingEnv !== "staging") {
    fail('staging vars.WE_MET_ENV must be "staging"');
  }
  const previewHostSuffix = config.vars?.WE_MET_PREVIEW_HOST_SUFFIX ?? "";
  if (previewHostSuffix.trim() !== "") {
    fail('staging vars.WE_MET_PREVIEW_HOST_SUFFIX must be ""');
  }
  const baseUrl = config.vars?.WE_MET_BASE_URL;
  if (baseUrl !== STAGING_RESOURCE_MARKERS.baseUrl) {
    fail(`staging vars.WE_MET_BASE_URL must be "${STAGING_RESOURCE_MARKERS.baseUrl}"`);
  }
  if (previewLoginReachableForWorkerEnv(stagingEnv, true)) {
    fail("preview-login route must not be reachable when vars.WE_MET_ENV is staging");
  }

  const strings = collectStrings(config);
  const productionMarkers = [
    PRODUCTION_RESOURCE_MARKERS.d1Name,
    PRODUCTION_RESOURCE_MARKERS.r2Bucket,
    PRODUCTION_RESOURCE_MARKERS.queue,
    PRODUCTION_RESOURCE_MARKERS.exchangeRateLimiterNamespaceId,
    PRODUCTION_RESOURCE_MARKERS.authRateLimiterNamespaceId,
    PRODUCTION_RESOURCE_MARKERS.appRateLimiterNamespaceId,
    PRODUCTION_RESOURCE_MARKERS.workerName,
    "we-met.link",
  ];
  for (const marker of productionMarkers) {
    if (strings.includes(marker)) {
      fail(`staging config references production resource "${marker}"`);
    }
  }

  checkStagingRoutes(config);
  checkStagingD1Id(config);

  const d1Rows = config.d1_databases ?? [];
  for (const row of d1Rows) {
    if (row.database_name !== NONPROD_RESOURCE_MARKERS.d1Name) {
      fail("staging D1 database_name must be we-met-db-nonprod");
    }
  }
  const r2Rows = config.r2_buckets ?? [];
  for (const row of r2Rows) {
    if (row.bucket_name !== NONPROD_RESOURCE_MARKERS.r2Bucket) {
      fail("staging R2 bucket must be we-met-assets-nonprod");
    }
  }
  const queueRows = config.queues?.producers ?? [];
  for (const row of queueRows) {
    if (row.queue !== NONPROD_RESOURCE_MARKERS.queue) {
      fail("staging queue producer must be we-met-followup-email-nonprod");
    }
  }
  checkRateLimitBindings(config.ratelimits, false);

  checkStagingWorkerSelfReference(config);

  if (config.send_email) {
    fail("staging must not bind send_email");
  }
  const crons = config.triggers?.crons ?? [];
  if (crons.length > 0) {
    fail("staging must not define triggers.crons");
  }
  const consumers = config.queues?.consumers ?? [];
  if (consumers.length > 0) {
    fail("staging must not define queue consumers");
  }
}

function checkProductionBlock(config) {
  if (config.name !== PRODUCTION_RESOURCE_MARKERS.workerName) {
    fail(`production Worker name must be "${PRODUCTION_RESOURCE_MARKERS.workerName}"`);
  }
  if (config.vars?.WE_MET_ENV !== "production") {
    fail('top-level WE_MET_ENV must be "production"');
  }
  const topLevelBaseUrl = config.vars?.WE_MET_BASE_URL;
  if (topLevelBaseUrl !== PRODUCTION_RESOURCE_MARKERS.baseUrl) {
    fail(
      `top-level vars.WE_MET_BASE_URL must be "${PRODUCTION_RESOURCE_MARKERS.baseUrl}"`,
    );
  }
  if (previewLoginReachableForWorkerEnv(config.vars?.WE_MET_ENV, true)) {
    fail(
      "preview-login route must not be reachable with top-level WE_MET_ENV; only previews.vars.WE_MET_ENV=preview with a secret",
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(
      config.vars ?? {},
      "WE_MET_PREVIEW_LOGIN_SECRET",
    )
  ) {
    fail("WE_MET_PREVIEW_LOGIN_SECRET must not appear in top-level wrangler vars");
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
  checkRateLimitBindings(rlRows, true);
  checkProductionAppHostRoute(config);
}

function main() {
  const { target, configPath, mailSafetyConfigPath } = parseArgs(process.argv.slice(2));
  const config = parseJsonc(readFileSync(configPath, "utf8"));

  checkNonprodMailSafety(mailSafetyConfigPath);

  const isConsumerTarget =
    target === "consumer-nonprod" || target === "consumer-production";
  const isWarmupTarget = target === "warmup-production";
  const isStagingFamily = target === "staging" || target === "staging-build";
  const isPreviewWorkerTarget = target === "preview-worker";
  if (
    !isConsumerTarget &&
    !isWarmupTarget &&
    !isStagingFamily &&
    !isPreviewWorkerTarget
  ) {
    checkWranglerDomainSettings(config);
    checkDistinctD1Ids(config);
  }

  if (target === "staging-build") {
    checkStagingBuildEnvironment();
    console.log("deploy-time guards passed (staging-build)");
    return;
  }

  if (target === "staging") {
    checkStagingBlock(config);
    console.log("deploy-time guards passed (staging)");
    return;
  }

  if (target === "preview-worker") {
    checkPreviewWorkerBlock(config);
    console.log("deploy-time guards passed (preview-worker)");
    return;
  }

  if (target === "preview") {
    checkPreviewBlock(config.previews);
    checkProdPreviewD1R2BindingPairs(config);
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

  if (target === "warmup-production") {
    checkWarmupProduction(config);
    console.log("deploy-time guards passed (warmup-production)");
    return;
  }

  if (target === "production") {
    checkProductionBlock(config);
    checkPreviewBlock(config.previews);
    checkProdPreviewD1R2BindingPairs(config);
    console.log("deploy-time guards passed (production)");
    return;
  }

  fail(`unknown --target ${target}`);
}

main();
