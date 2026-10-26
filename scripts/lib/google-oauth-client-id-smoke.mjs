/**
 * Parse Google OAuth client_id from a Google sign-in start redirect Location header.
 */

const GOOGLE_ACCOUNTS_HOST = "accounts.google.com";

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
 * @param {string} clientId
 * @returns {string}
 */
export function googleClientIdLogSuffix(clientId) {
  const trimmed = clientId.trim();
  if (trimmed.length <= 6) {
    return trimmed;
  }
  return trimmed.slice(-6);
}

/**
 * @param {string | null} stagingClientId
 * @param {string | null} productionClientId
 * @returns {{ ok: true } | { ok: false; reason: string }}
 */
export function compareGoogleOAuthClientIds(stagingClientId, productionClientId) {
  if (!stagingClientId || !productionClientId) {
    return { ok: false, reason: "unparsable" };
  }
  if (stagingClientId === productionClientId) {
    return { ok: false, reason: "equal" };
  }
  return { ok: true };
}
