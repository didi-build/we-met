/** Queue names for the warmup Worker (must stay aligned with wrangler.jsonc). */
export const WARMUP_SEND_RETRY_QUEUE = "we-met-warmup-send-retry";
export const WARMUP_SEND_DLQ = "we-met-warmup-send-dlq";

export const WARMUP_EMAIL_EVENTS_QUEUE = "we-met-warmup-email-events";
export const WARMUP_EMAIL_EVENTS_DLQ = "we-met-warmup-email-events-dlq";

/** Until DIDI-721 provisions queues, wrangler.jsonc may reference these placeholder names. */
export const WARMUP_EMAIL_EVENTS_QUEUE_PLACEHOLDER =
  "00000000-0000-0000-0000-000000000003";
export const WARMUP_EMAIL_EVENTS_DLQ_PLACEHOLDER =
  "00000000-0000-0000-0000-000000000004";

export const WARMUP_EMAIL_EVENTS_MAX_RETRIES = 3;
export const WARMUP_EMAIL_EVENTS_MAX_BATCH_SIZE = 10;
