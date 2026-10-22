/** Log-safe email hint (never the full local part). */
export function redactEmailForLog(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    return "<invalid>";
  }
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const hint = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${hint}@${domain}`;
}
