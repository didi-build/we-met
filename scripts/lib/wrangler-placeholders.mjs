/** Generated CI configs (gitignored); must live in repo root for Wrangler relative paths. */
export const WRANGLER_CI_CONFIG = "wrangler.ci.jsonc";
export const WRANGLER_D1_NONPROD_CI_CONFIG = "wrangler.d1-nonprod.ci.jsonc";

/** Placeholder D1 IDs in committed wrangler.jsonc (real IDs injected at deploy). */
export const D1_PLACEHOLDER_PRODUCTION = "00000000-0000-0000-0000-000000000001";
export const D1_PLACEHOLDER_NONPROD = "00000000-0000-0000-0000-000000000002";

export const PRODUCTION_RESOURCE_MARKERS = {
  d1Name: "we-met-db",
  r2Bucket: "we-met-assets",
  queue: "we-met-followup-email",
  rateLimiterNamespaceId: "2002",
  workerName: "we-met",
};

export const NONPROD_RESOURCE_MARKERS = {
  d1Name: "we-met-db-nonprod",
  r2Bucket: "we-met-assets-nonprod",
  queue: "we-met-followup-email-nonprod",
  rateLimiterNamespaceId: "2001",
  consumerWorkerName: "we-met-followup-email-consumer-nonprod",
};
