import { sanitizeExternalPlanText } from "./messages.mjs";

/**
 * @param {string} message
 * @returns {string}
 */
export function escapeForWorkflowCommand(message) {
  return sanitizeExternalPlanText(message)
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
}

/**
 * @param {string} message
 */
export function emitWorkflowWarning(message) {
  console.log(`::warning::${escapeForWorkflowCommand(message)}`);
}
