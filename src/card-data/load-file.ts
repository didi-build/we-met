import { assertValidSlug, isValidSlug } from "@/card-data/slug";
import type { BrandVariant, CardsLoadFile, CardLoadInput } from "@/card-data/types";

const VARIANTS = new Set<BrandVariant>(["green", "mono"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing or invalid string field: ${key}`);
  }
  return value;
}

function parseFooterLink(raw: unknown): CardLoadInput["footerLink"] {
  if (!isRecord(raw)) {
    throw new Error("footerLink must be an object");
  }
  return {
    label: requireString(raw, "label"),
    url: requireString(raw, "url"),
  };
}

function parseContactName(raw: unknown): CardLoadInput["contact"]["name"] {
  if (!isRecord(raw)) {
    throw new Error("contact.name must be an object");
  }
  return {
    full: requireString(raw, "full"),
    family: requireString(raw, "family"),
    given: requireString(raw, "given"),
    nickname: requireString(raw, "nickname"),
  };
}

function parseContact(raw: unknown): CardLoadInput["contact"] {
  if (!isRecord(raw)) {
    throw new Error("contact must be an object");
  }
  return {
    name: parseContactName(raw.name),
    org: requireString(raw, "org"),
    title: requireString(raw, "title"),
    email: requireString(raw, "email"),
    phone: requireString(raw, "phone"),
    vcardNote: requireString(raw, "vcardNote"),
  };
}

function parsePageCopy(raw: unknown): CardLoadInput["pageCopy"] {
  if (!isRecord(raw)) {
    throw new Error("pageCopy must be an object");
  }
  return {
    pageTitle: requireString(raw, "pageTitle"),
    emailFromName: requireString(raw, "emailFromName"),
    headshotAlt: requireString(raw, "headshotAlt"),
    greetingName: requireString(raw, "greetingName"),
    exchangeButton: requireString(raw, "exchangeButton"),
    bookLink: requireString(raw, "bookLink"),
  };
}

function parseCard(raw: unknown): CardLoadInput {
  if (!isRecord(raw)) {
    throw new Error("Each card must be an object");
  }
  const slug = requireString(raw, "slug");
  assertValidSlug(slug);
  const variant = requireString(raw, "variant");
  if (!VARIANTS.has(variant as BrandVariant)) {
    throw new Error(`Invalid variant: ${variant}`);
  }
  const photoKey =
    raw.photoKey === null
      ? null
      : typeof raw.photoKey === "string"
        ? raw.photoKey
        : (() => {
            throw new Error("photoKey must be a string or null");
          })();

  const exchangeCopy = raw.exchangeCopy;
  if (!isRecord(exchangeCopy)) {
    throw new Error("exchangeCopy must be an object");
  }

  return {
    slug,
    variant: variant as BrandVariant,
    displayName: requireString(raw, "displayName"),
    email: requireString(raw, "email"),
    photoKey,
    footerLink: parseFooterLink(raw.footerLink),
    pageCopy: parsePageCopy(raw.pageCopy),
    contact: parseContact(raw.contact),
    exchangeCopy,
  };
}

function parseHostnameMapping(raw: unknown): CardsLoadFile["hostnames"][number] {
  if (!isRecord(raw)) {
    throw new Error("Each hostname mapping must be an object");
  }
  const hostname = requireString(raw, "hostname").toLowerCase();
  const slug = requireString(raw, "slug");
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
