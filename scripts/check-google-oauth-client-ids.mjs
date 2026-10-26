#!/usr/bin/env node
/**
 * Post-deploy smoke: staging Google OAuth client_id must not match production.
 * Fetches only the staging sign-in start route (never production).
 */
import { pathToFileURL } from "node:url";
import {
  compareStagingClientIdToProductionFingerprint,
  parseGoogleClientIdFromOAuthLocation,
} from "./lib/google-oauth-client-id-smoke.mjs";

const STAGING_SIGN_IN_URL =
  "https://we-met.didi.build/api/auth/google/start?mode=redirect";

// Fingerprint of the production Google OAuth client_id (SHA-256 hex). Update when the
// production Google client is rotated (see docs/architecture/environments.md).
export const PROD_GOOGLE_CLIENT_ID_SHA256 =
  "241c5f234052fd56b325b30f86342f19bde300e93e9c81f6bd8b973e3ba10033";

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
 * @param {string} [productionFingerprintHex]
 * @returns {Promise<{ ok: true; logPrefix: string } | { ok: false; reason: string }>}
 */
export async function runGoogleOAuthClientIdSmoke(
  fetchImpl,
  productionFingerprintHex = PROD_GOOGLE_CLIENT_ID_SHA256,
) {
  const stagingClientId = await fetchGoogleClientIdFromSignInStart(
    STAGING_SIGN_IN_URL,
    fetchImpl,
  );
  const compared = compareStagingClientIdToProductionFingerprint(
    stagingClientId,
    productionFingerprintHex,
  );
  if (!compared.ok) {
    return { ok: false, reason: compared.reason };
  }
  return { ok: true, logPrefix: compared.logPrefix };
}

async function main() {
  const result = await runGoogleOAuthClientIdSmoke(fetch);
  if (!result.ok) {
    if (result.reason === "equal") {
      console.error(
        "::error::Staging Google OAuth client_id matches the production client fingerprint. Staging must use a separate OAuth client.",
      );
    } else {
      console.error(
        "::error::Could not parse Google OAuth client_id from staging sign-in redirect.",
      );
    }
    process.exit(1);
  }
  console.log(
    `Staging Google OAuth client_id SHA-256 prefix ${result.logPrefix} (production fingerprint differs).`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`::error::Google OAuth client_id smoke check failed: ${message}`);
    process.exit(1);
  });
}
