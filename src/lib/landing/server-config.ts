import { readWeMetHostConfig } from "@/config/we-met";

/** Host config for marketing pages (no D1; safe during static prerender). */
export function readLandingHostConfig() {
  return readWeMetHostConfig({
    WE_MET_BASE_URL: process.env.WE_MET_BASE_URL,
    WE_MET_PREVIEW_HOST_SUFFIX: process.env.WE_MET_PREVIEW_HOST_SUFFIX,
    WE_MET_ENV: process.env.WE_MET_ENV,
  });
}
