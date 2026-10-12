import type { D1Database, Queue, R2Bucket } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    WE_MET_DB: D1Database;
    WE_MET_ASSETS: R2Bucket;
    WE_MET_BASE_URL: string;
    WE_MET_PREVIEW_HOST_SUFFIX?: string;
    WE_MET_ENV?: string;
    WE_MET_TOKEN_SECRET?: string;
    TURNSTILE_SECRET_KEY?: string;
    WE_MET_FOLLOWUP_EMAIL_QUEUE?: Queue;
    WE_MET_EXCHANGE_RATE_LIMITER?: {
      limit(options: { key: string }): Promise<{ success: boolean }>;
    };
  }
}

export {};
