#!/usr/bin/env node
/**
 * Post-deploy smoke: staging and production Google OAuth client ids must differ.
 * Fetches sign-in start routes without following redirects; never logs full client ids.
 */
import { pathToFileURL } from "node:url";
import {
  compareGoogleOAuthClientIds,
  googleClientIdLogSuffix,
  parseGoogleClientIdFromOAuthLocation,
} from "./lib/google-oauth-client-id-smoke.mjs";

const STAGING_SIGN_IN_URL =
  "https://we-met.didi.build/api/auth/google/start?mode=redirect";
const PRODUCTION_SIGN_IN_URL =
  "https://app.we-met.link/api/auth/google/start?mode=redirect";

/**
 * @param {string} signInUrl
 * @param {(input: string, init?: RequestInit) => Promise<Response>} fetchImpl
 * @returns {Promise<string | null>}
 */
export async function fetchGoogleClientIdFromSignInStart(signInUrl, fetchImpl) {
  const response = await fetchImpl(signInUrl, { redirect: "manual" });
  const location = response.headers.get("location");
  return parseGoogleClientIdFromOAuthLocation(location);
}

/**
 * @param {(input: string, init?: RequestInit) => Promise<Response>} fetchImpl
 * @returns {Promise<{ ok: true; stagingSuffix: string; productionSuffix: string } | { ok: false; reason: string }>}
 */
export async function runGoogleOAuthClientIdSmoke(fetchImpl) {
  const stagingClientId = await fetchGoogleClientIdFromSignInStart(
    STAGING_SIGN_IN_URL,
    fetchImpl,
  );
  const productionClientId = await fetchGoogleClientIdFromSignInStart(
    PRODUCTION_SIGN_IN_URL,
    fetchImpl,
  );
  const compared = compareGoogleOAuthClientIds(stagingClientId, productionClientId);
  if (!compared.ok) {
    return { ok: false, reason: compared.reason };
  }
  return {
    ok: true,
    stagingSuffix: googleClientIdLogSuffix(stagingClientId),
    productionSuffix: googleClientIdLogSuffix(productionClientId),
  };
}

async function main() {
  const result = await runGoogleOAuthClientIdSmoke(fetch);
  if (!result.ok) {
    if (result.reason === "equal") {
      console.error(
        "::error::Staging and production Google OAuth client_id are the same. Staging must use a separate OAuth client.",
      );
    } else {
      console.error(
        "::error::Could not parse Google OAuth client_id from staging or production sign-in redirect.",
      );
    }
    process.exit(1);
  }
  console.log(
    `Google OAuth client_id suffixes differ (staging …${result.stagingSuffix}, production …${result.productionSuffix}).`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("::error::Google OAuth client_id smoke check failed:", err);
    process.exit(1);
  });
}
