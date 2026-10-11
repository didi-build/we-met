import type { D1Database } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    WE_MET_DB: D1Database;
    WE_MET_BASE_URL: string;
    WE_MET_PREVIEW_HOST_SUFFIX?: string;
    WE_MET_ENV?: string;
  }
}

export {};
