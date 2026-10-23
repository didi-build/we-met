import type {
  D1Database,
  ImagesBinding,
  Queue,
  R2Bucket,
} from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    WE_MET_DB: D1Database;
    WE_MET_ASSETS: R2Bucket;
    IMAGES?: ImagesBinding;
    WE_MET_BASE_URL: string;
    WE_MET_PREVIEW_HOST_SUFFIX?: string;
    WE_MET_ENV?: string;
    WE_MET_TOKEN_SECRET?: string;
    TURNSTILE_SECRET_KEY?: string;
    WE_MET_FOLLOWUP_EMAIL_QUEUE?: Queue;
    WE_MET_EXCHANGE_RATE_LIMITER?: {
      limit(options: { key: string }): Promise<{ success: boolean }>;
    };
    WE_MET_AUTH_RATE_LIMITER?: {
      limit(options: { key: string }): Promise<{ success: boolean }>;
    };
    WE_MET_APP_RATE_LIMITER?: {
      limit(options: { key: string }): Promise<{ success: boolean }>;
    };
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    WE_MET_APP_ORIGIN?: string;
    WE_MET_PREVIEW_LOGIN_SECRET?: string;
    WE_MET_PREVIEW_LOGIN_EMAIL?: string;
    WE_MET_CONTACT_SENDER_ADDRESSES?: string;
    CONTACTS_SETUP_ALLOWLIST?: string;
    CONTACTS_SETUP_ENABLED_FOR_ALL?: string;
  }
}

export {};
