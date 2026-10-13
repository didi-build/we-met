const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const HEX32_RE = /\b[0-9a-f]{32}\b/gi;

/**
 * Redact UUIDs and 32-char hex IDs from wrangler output before posting publicly.
 *
 * @param {string} text
 * @returns {string}
 */
export function redactMigrationLog(text) {
  return text.replace(UUID_RE, "[redacted-uuid]").replace(HEX32_RE, "[redacted-id]");
}
