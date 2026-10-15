/** Slugs blocked at claim time (impersonation), not routing. `didi` is intentionally allowed. */
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "billing",
  "help",
  "login",
  "official",
  "pricing",
  "privacy",
  "security",
  "signin",
  "signup",
  "staff",
  "support",
  "terms",
  "we-met",
  "wemet",
  "www",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
