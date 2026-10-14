import { sanitizeExternalPlanText } from "./messages.mjs";

/**
 * @param {{
 *   commitSha?: string | null;
 *   prNumber?: number | null;
 *   prTitle?: string | null;
 * }} input
 * @returns {string}
 */
export function formatMigrationIntroduction(input) {
  const commit =
    input.commitSha && input.commitSha.length > 0
      ? `commit \`${sanitizeExternalPlanText(input.commitSha.slice(0, 12))}\``
      : "commit unknown";
  if (input.prNumber != null && Number.isFinite(input.prNumber)) {
    const title =
      input.prTitle && input.prTitle.length > 0
        ? sanitizeExternalPlanText(input.prTitle)
        : "untitled";
    return `Introduction: ${commit}, PR #${input.prNumber} (${title})`;
  }
  return `Introduction: ${commit}, PR unknown`;
}
