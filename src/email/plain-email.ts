const PLAIN_EMAIL_FORBIDDEN = /[\s,;<>"\\()\u0000-\u001f\u007f]/;

/** Single RFC5322 addr-spec style address (no display names or multiple recipients). */
export function isPlainSingleEmailAddress(email: string): boolean {
  if (!email || PLAIN_EMAIL_FORBIDDEN.test(email)) {
    return false;
  }
  const at = email.indexOf("@");
  if (at <= 0 || email.indexOf("@", at + 1) !== -1) {
    return false;
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return local.length > 0 && domain.length > 0;
}
