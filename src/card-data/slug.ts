const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MIN_LENGTH = 1;
const SLUG_MAX_LENGTH = 48;

export function isValidSlug(slug: string): boolean {
  if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH) {
    return false;
  }
  if (slug.startsWith("-") || slug.endsWith("-")) {
    return false;
  }
  return SLUG_PATTERN.test(slug);
}

export function assertValidSlug(slug: string): void {
  if (!isValidSlug(slug)) {
    throw new Error(`Invalid slug: "${slug}"`);
  }
}
