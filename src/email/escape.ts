const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/g;

/** Short plain text for email bodies (user-supplied fields). */
export function escapePlainTextForEmail(value: string): string {
  return value.replace(CONTROL_CHAR_PATTERN, " ").replace(/\s+/g, " ").trim();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
