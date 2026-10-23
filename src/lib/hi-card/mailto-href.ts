/** Characters rejected in mailto addresses (RFC 6068 unsafe / structural). */
const MAILTO_FORBIDDEN = /[?&#%\s\u0000-\u001F\u007F]/;

/**
 * Build a mailto: href with a literal @ between encoded local-part and domain.
 * Returns null when the address is empty or contains forbidden characters.
 */
export function mailtoHref(rawEmail: string): string | null {
  const email = rawEmail.trim();
  if (!email || MAILTO_FORBIDDEN.test(email)) {
    return null;
  }
  const at = email.lastIndexOf("@");
  if (at <= 0 || at >= email.length - 1) {
    return null;
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (
    !local ||
    !domain ||
    MAILTO_FORBIDDEN.test(local) ||
    MAILTO_FORBIDDEN.test(domain)
  ) {
    return null;
  }
  return `mailto:${encodeURIComponent(local)}@${encodeURIComponent(domain)}`;
}
