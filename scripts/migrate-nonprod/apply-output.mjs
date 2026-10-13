import { formatMarkdownCodeFence } from "./markdown-fence.mjs";
import { redactMigrationLog } from "./redact.mjs";
import { sanitizeForComment } from "./sanitize-for-comment.mjs";

/**
 * @param {string} error
 */
export function formatApplyFailureCommentError(error) {
  return sanitizeForComment(redactMigrationLog(error));
}

/**
 * @param {string} output
 */
export function formatApplyResultSummaryBlock(output) {
  const redacted = redactMigrationLog(output);
  return `### Result\n\n${formatMarkdownCodeFence(redacted)}`;
}
