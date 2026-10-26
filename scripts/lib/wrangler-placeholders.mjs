/** Generated CI configs (gitignored); must live in repo root for Wrangler relative paths. */
export const WRANGLER_CI_CONFIG = "wrangler.ci.jsonc";
export const WRANGLER_STAGING_CI_CONFIG = "wrangler.staging.ci.jsonc";
export const WRANGLER_D1_NONPROD_CI_CONFIG = "wrangler.d1-nonprod.ci.jsonc";

/** Placeholder D1 IDs in committed wrangler.jsonc (real IDs injected at deploy). */
export const D1_PLACEHOLDER_PRODUCTION = "00000000-0000-0000-0000-000000000001";
export const D1_PLACEHOLDER_NONPROD = "00000000-0000-0000-0000-000000000002";

/** Placeholder KV namespace id in workers/warmup/wrangler.jsonc until production id is committed or injected. */
export const WARMUP_KV_PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Warmup email-events queue names (committed in workers/warmup/wrangler.jsonc).
 * Deploy guards reject the zero UUID placeholders below if they appear in consumer
 * queue or dead_letter_queue fields (same idea as WARMUP_KV_PLACEHOLDER_ID).
 */
export const WARMUP_EMAIL_EVENTS_QUEUE = "we-met-warmup-email-events";
export const WARMUP_EMAIL_EVENTS_DLQ = "we-met-warmup-email-events-dlq";
export const WARMUP_EMAIL_EVENTS_QUEUE_PLACEHOLDER =
  "00000000-0000-0000-0000-000000000003";
export const WARMUP_EMAIL_EVENTS_DLQ_PLACEHOLDER =
  "00000000-0000-0000-0000-000000000004";

export const PRODUCTION_APP_HOST = "app.we-met.link";

export const PRODUCTION_RESOURCE_MARKERS = {
  d1Name: "we-met-db",
  r2Bucket: "we-met-assets",
  queue: "we-met-followup-email",
  exchangeRateLimiterNamespaceId: "2002",
  authRateLimiterNamespaceId: "2004",
  appRateLimiterNamespaceId: "2006",
  workerName: "we-met",
  baseUrl: "https://we-met.link",
};

export const STAGING_RESOURCE_MARKERS = {
  workerName: "we-met-staging",
  hostname: "we-met.didi.build",
  baseUrl: "https://we-met.didi.build",
};

export const NONPROD_RESOURCE_MARKERS = {
  d1Name: "we-met-db-nonprod",
  r2Bucket: "we-met-assets-nonprod",
  queue: "we-met-followup-email-nonprod",
  exchangeRateLimiterNamespaceId: "2001",
  authRateLimiterNamespaceId: "2003",
  appRateLimiterNamespaceId: "2005",
  consumerWorkerName: "we-met-followup-email-consumer-nonprod",
  // Intentionally the staging public origin: preview vars and non-prod consumer mail links match we-met.didi.build.
  baseUrl: STAGING_RESOURCE_MARKERS.baseUrl,
};

export const RATE_LIMIT_BINDINGS = {
  exchange: "WE_MET_EXCHANGE_RATE_LIMITER",
  auth: "WE_MET_AUTH_RATE_LIMITER",
  app: "WE_MET_APP_RATE_LIMITER",
};
