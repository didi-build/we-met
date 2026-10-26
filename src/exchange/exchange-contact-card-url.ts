export function exchangeContactCardDownloadUrl(
  baseUrl: string,
  leadId: string,
  token: string,
): string {
  const origin = baseUrl.replace(/\/$/, "");
  const path = `/api/exchange/${encodeURIComponent(leadId)}/contact-card`;
  return `${origin}${path}?token=${encodeURIComponent(token)}`;
}
