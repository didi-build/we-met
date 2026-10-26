import { createHash } from "node:crypto";

/**
 * Parse Google OAuth client_id from a Google sign-in start redirect Location header.
 */

const GOOGLE_ACCOUNTS_HOST = "accounts.google.com";

/**
 * @param {string} clientId
 * @returns {string}
 */
export function sha256HexClientId(clientId) {
  return createHash("sha256").update(clientId, "utf8").digest("hex");
}

/**
 * @param {string} clientId
 * @returns {string}
 */
export function stagingClientIdSha256LogPrefix(clientId) {
  return sha256HexClientId(clientId).slice(0, 8);
}

/**
 * @param {string | null | undefined} location
 * @returns {string | null}
 */
export function parseGoogleClientIdFromOAuthLocation(location) {
  if (!location || typeof location !== "string") {
    return null;
  }
  const trimmed = location.trim();
  if (!trimmed) {
    return null;
  }
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.hostname !== GOOGLE_ACCOUNTS_HOST) {
    return null;
  }
  const clientId = url.searchParams.get("client_id")?.trim();
  if (!clientId) {
    return null;
  }
  return clientId;
}

/**
 * @param {string | null | undefined} stagingClientId
 * @param {string} productionClientIdSha256Hex
 * @returns {{ ok: true; logPrefix: string } | { ok: false; reason: "unparsable" | "equal" }}
 */
export function compareStagingClientIdToProductionFingerprint(
  stagingClientId,
  productionClientIdSha256Hex,
) {
  if (!stagingClientId) {
    return { ok: false, reason: "unparsable" };
  }
  const stagingHash = sha256HexClientId(stagingClientId);
  if (stagingHash === productionClientIdSha256Hex) {
    return { ok: false, reason: "equal" };
  }
  return { ok: true, logPrefix: stagingHash.slice(0, 8) };
}
