import { assertValidSlug, isValidSlug } from "@/card-data/slug";
import { LOAD_STRING_LIMITS, assertNoControlCharacters } from "@/card-data/load-sql";
import type { BrandVariant, CardsLoadFile, CardLoadInput } from "@/card-data/types";

const VARIANTS = new Set<BrandVariant>(["green", "mono"]);

const BASIC_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireBoundedString(
  obj: Record<string, unknown>,
  key: string,
  maxLength: number,
): string {
  const value = obj[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing or invalid string field: ${key}`);
  }
  assertNoControlCharacters(value, key);
  if (value.length > maxLength) {
    throw new Error(`${key} exceeds max length ${maxLength}`);
  }
  return value;
}

function requireHttpsUrl(raw: string, field: string): string {
  assertNoControlCharacters(raw, field);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${field} must use https`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${field} must not include credentials`);
  }
  return parsed.toString();
}

function requireEmail(value: string, field: string): string {
  assertNoControlCharacters(value, field);
  if (value.length > LOAD_STRING_LIMITS.email) {
    throw new Error(`${field} exceeds max length ${LOAD_STRING_LIMITS.email}`);
  }
  if (!BASIC_EMAIL.test(value)) {
    throw new Error(`${field} must be a valid email address`);
  }
  return value;
}

function parseFooterLink(raw: unknown): CardLoadInput["footerLink"] {
  if (!isRecord(raw)) {
    throw new Error("footerLink must be an object");
  }
  const label = requireBoundedString(raw, "label", LOAD_STRING_LIMITS.footerLabel);
  const urlRaw = requireBoundedString(raw, "url", LOAD_STRING_LIMITS.footerUrl);
  return {
    label,
    url: requireHttpsUrl(urlRaw, "footerLink.url"),
  };
}

function parseContactName(raw: unknown): CardLoadInput["contact"]["name"] {
  if (!isRecord(raw)) {
    throw new Error("contact.name must be an object");
  }
  return {
    full: requireBoundedString(raw, "full", LOAD_STRING_LIMITS.contactField),
    family: requireBoundedString(raw, "family", LOAD_STRING_LIMITS.contactField),
    given: requireBoundedString(raw, "given", LOAD_STRING_LIMITS.contactField),
    nickname: requireBoundedString(raw, "nickname", LOAD_STRING_LIMITS.contactField),
  };
}

function parseContact(raw: unknown): CardLoadInput["contact"] {
  if (!isRecord(raw)) {
    throw new Error("contact must be an object");
  }
  const email = requireBoundedString(raw, "email", LOAD_STRING_LIMITS.contactEmail);
  return {
    name: parseContactName(raw.name),
    org: requireBoundedString(raw, "org", LOAD_STRING_LIMITS.contactField),
    title: requireBoundedString(raw, "title", LOAD_STRING_LIMITS.contactField),
    email: requireEmail(email, "contact.email"),
    phone: requireBoundedString(raw, "phone", LOAD_STRING_LIMITS.contactPhone),
    vcardNote: requireBoundedString(raw, "vcardNote", LOAD_STRING_LIMITS.contactField),
  };
}

function parsePageCopy(raw: unknown): CardLoadInput["pageCopy"] {
  if (!isRecord(raw)) {
    throw new Error("pageCopy must be an object");
  }
  return {
    pageTitle: requireBoundedString(raw, "pageTitle", LOAD_STRING_LIMITS.pageCopyField),
    emailFromName: requireBoundedString(
      raw,
      "emailFromName",
      LOAD_STRING_LIMITS.pageCopyField,
    ),
    headshotAlt: requireBoundedString(
      raw,
      "headshotAlt",
      LOAD_STRING_LIMITS.pageCopyField,
    ),
    greetingName: requireBoundedString(
      raw,
      "greetingName",
      LOAD_STRING_LIMITS.pageCopyField,
    ),
    exchangeButton: requireBoundedString(
      raw,
      "exchangeButton",
      LOAD_STRING_LIMITS.pageCopyField,
    ),
    bookLink: requireBoundedString(raw, "bookLink", LOAD_STRING_LIMITS.pageCopyField),
  };
}

function parseExchangeCopy(raw: unknown): CardLoadInput["exchangeCopy"] {
  if (!isRecord(raw)) {
    throw new Error("exchangeCopy must be an object of string values");
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.length > LOAD_STRING_LIMITS.exchangeCopyKey) {
      throw new Error(
        `exchangeCopy key exceeds max length ${LOAD_STRING_LIMITS.exchangeCopyKey}`,
      );
    }
    assertNoControlCharacters(key, "exchangeCopy key");
    if (typeof value !== "string") {
      throw new Error("exchangeCopy values must be strings");
    }
    assertNoControlCharacters(value, `exchangeCopy.${key}`);
    if (value.length > LOAD_STRING_LIMITS.exchangeCopyValue) {
      throw new Error(
        `exchangeCopy.${key} exceeds max length ${LOAD_STRING_LIMITS.exchangeCopyValue}`,
      );
    }
    result[key] = value;
  }
  return result;
}

function parseCard(raw: unknown): CardLoadInput {
  if (!isRecord(raw)) {
    throw new Error("Each card must be an object");
  }
  const slug = requireBoundedString(raw, "slug", 64);
  assertValidSlug(slug);
  const variant = requireBoundedString(raw, "variant", 16);
  if (!VARIANTS.has(variant as BrandVariant)) {
    throw new Error(`Invalid variant: ${variant}`);
  }
  const photoKey =
    raw.photoKey === null
      ? null
      : typeof raw.photoKey === "string"
        ? (() => {
            assertNoControlCharacters(raw.photoKey as string, "photoKey");
            if ((raw.photoKey as string).length > LOAD_STRING_LIMITS.photoKey) {
              throw new Error(
                `photoKey exceeds max length ${LOAD_STRING_LIMITS.photoKey}`,
              );
            }
            return raw.photoKey as string;
          })()
        : (() => {
            throw new Error("photoKey must be a string or null");
          })();

  const displayName = requireBoundedString(
    raw,
    "displayName",
    LOAD_STRING_LIMITS.displayName,
  );
  const email = requireEmail(
    requireBoundedString(raw, "email", LOAD_STRING_LIMITS.email),
    "email",
  );

  return {
    slug,
    variant: variant as BrandVariant,
    displayName,
    email,
    photoKey,
    footerLink: parseFooterLink(raw.footerLink),
    pageCopy: parsePageCopy(raw.pageCopy),
    contact: parseContact(raw.contact),
    exchangeCopy: parseExchangeCopy(raw.exchangeCopy),
  };
}

function parseHostnameMapping(raw: unknown): CardsLoadFile["hostnames"][number] {
  if (!isRecord(raw)) {
    throw new Error("Each hostname mapping must be an object");
  }
  const hostname = requireBoundedString(raw, "hostname", 253).toLowerCase();
  const slug = requireBoundedString(raw, "slug", 64);
  if (!isValidSlug(slug)) {
    throw new Error(`Invalid slug in hostname mapping: ${slug}`);
  }
  return { hostname, slug };
}

export function parseCardsLoadFile(raw: unknown): CardsLoadFile {
  if (!isRecord(raw)) {
    throw new Error("Load file must be a JSON object");
  }
  if (!Array.isArray(raw.cards)) {
    throw new Error("Load file must include a cards array");
  }
  if (!Array.isArray(raw.hostnames)) {
    throw new Error("Load file must include a hostnames array");
  }
  if (raw.leadSinks !== undefined) {
    throw new Error("leadSinks are not loaded in step 1");
  }
  return {
    cards: raw.cards.map(parseCard),
    hostnames: raw.hostnames.map(parseHostnameMapping),
  };
}
