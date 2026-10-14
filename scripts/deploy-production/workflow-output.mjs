import { sanitizeExternalPlanText } from "./messages.mjs";

/**
 * Workflow command escaping only (caller should sanitize user-derived text first).
 *
 * @param {string} message
 * @returns {string}
 */
export function escapeForWorkflowCommand(message) {
  return message.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

/**
 * @param {string} message
 */
export function emitWorkflowWarning(message) {
  const safe = sanitizeExternalPlanText(message);
  console.log(`::warning::${escapeForWorkflowCommand(safe)}`);
}
