/** First token of the visitor name for `{firstName}` substitution (plain text, not headers). */
export function visitorFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return "there";
  }
  return trimmed.split(/\s+/)[0] ?? "there";
}
