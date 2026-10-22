#!/usr/bin/env node
/**
 * Deploy-time guards from docs/architecture/environments.md#deploy-time-guards
 *
 * Usage:
 *   node scripts/check-deploy-guards.mjs --target preview --config wrangler.jsonc
 *   node scripts/check-deploy-guards.mjs --target production --config wrangler.jsonc
 *   node scripts/check-deploy-guards.mjs --target consumer-nonprod --config workers/we-met-followup-email-consumer/wrangler.nonprod.jsonc
 *   node scripts/check-deploy-guards.mjs --target consumer-production --config workers/we-met-followup-email-consumer/wrangler.production.jsonc
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
  NONPROD_RESOURCE_MARKERS,
  PRODUCTION_APP_HOST,
  PRODUCTION_RESOURCE_MARKERS,
  RATE_LIMIT_BINDINGS,
  WARMUP_KV_PLACEHOLDER_ID,
  WARMUP_EMAIL_EVENTS_DLQ,
  WARMUP_EMAIL_EVENTS_DLQ_PLACEHOLDER,
  WARMUP_EMAIL_EVENTS_QUEUE,
  WARMUP_EMAIL_EVENTS_QUEUE_PLACEHOLDER,
} from "./lib/wrangler-placeholders.mjs";

const WARMUP_WORKER_NAME = "we-met-warmup-cron";
const WARMUP_RETRY_QUEUE = "we-met-warmup-send-retry";
const WARMUP_DLQ = "we-met-warmup-send-dlq";
const WARMUP_STATE_BINDING = "WARMUP_STATE";
const WARMUP_EMAIL_EVENTS_MAX_RETRIES = 3;
const WARMUP_EMAIL_EVENTS_MAX_BATCH_SIZE = 10;
import { previewLoginReachableForWorkerEnv } from "./lib/preview-login-guard.mjs";

function usage() {
  console.error(
    "Usage: check-deploy-guards.mjs --target <preview|production|consumer-nonprod|consumer-production|warmup-production> --config <path> [--mail-safety-config <path>]",
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

function checkPreviewBlock(previews) {
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
  checkRateLimitBindings(previews?.ratelimits, false);
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

function checkProductionBlock(config) {
  if (config.name !== PRODUCTION_RESOURCE_MARKERS.workerName) {
    fail(`production Worker name must be "${PRODUCTION_RESOURCE_MARKERS.workerName}"`);
  }
  if (config.vars?.WE_MET_ENV !== "production") {
    fail('top-level WE_MET_ENV must be "production"');
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
  if (!isConsumerTarget && !isWarmupTarget) {
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

  if (target === "warmup-production") {
    checkWarmupProduction(config);
    console.log("deploy-time guards passed (warmup-production)");
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
