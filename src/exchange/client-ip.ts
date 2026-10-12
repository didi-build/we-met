export function clientIpFromHeaders(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) {
    return cf;
  }
  return "unknown";
}
