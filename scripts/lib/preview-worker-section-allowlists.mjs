/** Binding section keys in committed wrangler.preview.jsonc (see test/check-deploy-guards.test.ts). */

export const PREVIEW_WORKER_TOP_LEVEL_BINDING_SECTIONS = new Set([
  "analytics_engine_datasets",
  "assets",
  "d1_databases",
  "images",
  "queues",
  "r2_buckets",
  "ratelimits",
  "services",
]);

export const PREVIEW_WORKER_PREVIEWS_BLOCK_BINDING_SECTIONS = new Set([
  "analytics_engine_datasets",
  "d1_databases",
  "images",
  "queues",
  "r2_buckets",
  "ratelimits",
  "services",
]);

export const PREVIEW_WORKER_PREVIEWS_BLOCK_ALLOWED_KEYS = new Set([
  ...PREVIEW_WORKER_PREVIEWS_BLOCK_BINDING_SECTIONS,
  "vars",
  "observability",
]);

export const PREVIEW_WORKER_TOP_LEVEL_ALLOWED_KEYS = new Set([
  ...PREVIEW_WORKER_TOP_LEVEL_BINDING_SECTIONS,
  "vars",
  "observability",
  "$schema",
  "name",
  "main",
  "workers_dev",
  "preview_urls",
  "compatibility_date",
  "compatibility_flags",
  "previews",
]);
