const DEFAULT_MAX_LENGTH = 2000;

/**
 * Sanitize PR-controlled text before embedding in a GitHub comment code fence.
 *
 * @param {string} text
 * @param {{ maxLength?: number }} [opts]
 * @returns {string}
 */
export function sanitizeForComment(text, opts = {}) {
  const maxLength = opts.maxLength ?? DEFAULT_MAX_LENGTH;
  let out = text.replace(/`/g, "'").replace(/[\0-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");
  out = out.replace(/\r\n|\r|\n/g, " ");
  out = out.replace(/<!--/g, "⟨!--").replace(/-->/g, "--⟩");
  if (out.length > maxLength) {
    out = `${out.slice(0, maxLength - 1)}…`;
  }
  return out;
}
