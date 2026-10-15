import { CARD_FIELD_LIMITS } from "@/card-data/limits";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MIN_LENGTH = CARD_FIELD_LIMITS.slugMin;
const SLUG_MAX_LENGTH = CARD_FIELD_LIMITS.slugMax;

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
