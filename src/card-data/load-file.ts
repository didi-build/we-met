import { assertValidHostname } from "@/card-data/hostname";
import {
  LEAD_SINK_ID_PATTERN,
  MAX_EMAIL_SINKS_PER_CARD,
  MAX_LEAD_SINKS_PER_CARD,
} from "@/card-data/load-limits";
import { assertNoControlCharacters } from "@/card-data/load-sql";
import { parseLeadSinkConfig } from "@/card-data/lead-sink-registry";
import { registerBuiltInLeadSinkKinds } from "@/card-data/register-lead-sink-kinds";
import { assertValidSlug, isValidSlug } from "@/card-data/slug";
import type {
  BrandVariant,
  CardCopy,
  CardFooterLink,
  CardLinks,
  CardsLoadFile,
  CardLoadInput,
  ContactUrl,
  FooterLinkKind,
  LeadSinkLoadInput,
} from "@/card-data/types";

const VARIANTS = new Set<BrandVariant>(["green", "mono"]);
const FOOTER_KINDS = new Set<FooterLinkKind>([
  "site",
  "linkedin",
  "github",
  "portfolio",
  "google",
]);

const BASIC_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_TOKEN = /\{([^}]+)\}/g;
const URL_TYPE_RE = /^[a-zA-Z0-9]{1,30}$/;

const LIMITS = {
  displayName: 200,
  email: 254,
  photoKey: 256,
  pageCopyField: 500,
  contactField: 500,
  contactEmail: 254,
  contactPhone: 64,
  copyLeaf: 1000,
  chipLabel: 60,
  chipExplanation: 500,
  footerLabel: 60,
  url: 2048,
  expandedParagraphs: 6,
  chips: 12,
  bodyParagraphs: 6,
  footerItems: 6,
  contactUrls: 8,
  urlType: 30,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertAllowedKeys(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  context: string,
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      throw new Error(`Unknown key in ${context}: ${key}`);
    }
  }
}

function requireNonWhitespaceString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing or invalid string field: ${field}`);
  }
  if (!/\S/.test(value)) {
    throw new Error(`${field} must contain non-whitespace text`);
  }
  assertNoControlCharacters(value, field);
  if (value.length > maxLength) {
    throw new Error(`${field} exceeds max length ${maxLength}`);
  }
  return value;
}

function requireCopyString(
  value: unknown,
  field: string,
  maxLength: number = LIMITS.copyLeaf,
): string {
  const str = requireNonWhitespaceString(value, field, maxLength);
  assertOnlyFirstNamePlaceholder(str, field);
  return str;
}

function assertOnlyFirstNamePlaceholder(value: string, field: string): void {
  for (const match of value.matchAll(PLACEHOLDER_TOKEN)) {
    if (match[1] !== "firstName") {
      throw new Error(`Invalid placeholder in ${field}: {${match[1]}}`);
    }
  }
}

function requireHttpsUrl(raw: string, field: string): string {
  assertNoControlCharacters(raw, field);
  if (!raw.startsWith("https://")) {
    throw new Error(`${field} must start with https://`);
  }
  if (/\s/.test(raw)) {
    throw new Error(`${field} must not contain whitespace`);
  }
  if (raw.length > LIMITS.url) {
    throw new Error(`${field} exceeds max length ${LIMITS.url}`);
  }
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
  return raw;
}

function requireEmail(value: string, field: string): string {
  assertNoControlCharacters(value, field);
  if (value.length > LIMITS.email) {
    throw new Error(`${field} exceeds max length ${LIMITS.email}`);
  }
  if (!BASIC_EMAIL.test(value)) {
    throw new Error(`${field} must be a valid email address`);
  }
  return value;
}

function parseLinks(raw: unknown): CardLinks {
  if (!isRecord(raw)) {
    throw new Error("links must be an object");
  }
  assertAllowedKeys(raw, ["bookingUrl", "footer"], "links");
  const bookingUrl =
    raw.bookingUrl === undefined
      ? undefined
      : requireHttpsUrl(
          requireNonWhitespaceString(raw.bookingUrl, "links.bookingUrl", LIMITS.url),
          "links.bookingUrl",
        );
  if (!Array.isArray(raw.footer)) {
    throw new Error("links.footer must be an array");
  }
  if (raw.footer.length < 1 || raw.footer.length > LIMITS.footerItems) {
    throw new Error(`links.footer must have 1–${LIMITS.footerItems} items`);
  }
  const footer = raw.footer.map((item, index) => parseFooterItem(item, index));
  return { bookingUrl, footer };
}

function parseFooterItem(raw: unknown, index: number): CardFooterLink {
  if (!isRecord(raw)) {
    throw new Error(`links.footer[${index}] must be an object`);
  }
  assertAllowedKeys(raw, ["kind", "label", "url"], `links.footer[${index}]`);
  const kind = requireNonWhitespaceString(raw.kind, `links.footer[${index}].kind`, 32);
  if (!FOOTER_KINDS.has(kind as FooterLinkKind)) {
    throw new Error(`Invalid footer kind: ${kind}`);
  }
  const label = requireNonWhitespaceString(
    raw.label,
    `links.footer[${index}].label`,
    LIMITS.footerLabel,
  );
  const url = requireHttpsUrl(
    requireNonWhitespaceString(raw.url, `links.footer[${index}].url`, LIMITS.url),
    `links.footer[${index}].url`,
  );
  return { kind: kind as FooterLinkKind, label, url };
}

function parseContactName(raw: unknown): CardLoadInput["contact"]["name"] {
  if (!isRecord(raw)) {
    throw new Error("contact.name must be an object");
  }
  assertAllowedKeys(raw, ["full", "family", "given", "nickname"], "contact.name");
  return {
    full: requireNonWhitespaceString(
      raw.full,
      "contact.name.full",
      LIMITS.contactField,
    ),
    family: requireNonWhitespaceString(
      raw.family,
      "contact.name.family",
      LIMITS.contactField,
    ),
    given: requireNonWhitespaceString(
      raw.given,
      "contact.name.given",
      LIMITS.contactField,
    ),
    nickname: requireNonWhitespaceString(
      raw.nickname,
      "contact.name.nickname",
      LIMITS.contactField,
    ),
  };
}

function parseContactUrl(raw: unknown, index: number): ContactUrl {
  if (!isRecord(raw)) {
    throw new Error(`contact.urls[${index}] must be an object`);
  }
  assertAllowedKeys(raw, ["url", "type"], `contact.urls[${index}]`);
  const url = requireHttpsUrl(
    requireNonWhitespaceString(raw.url, `contact.urls[${index}].url`, LIMITS.url),
    `contact.urls[${index}].url`,
  );
  let type: string | undefined;
  if (raw.type !== undefined) {
    type = requireNonWhitespaceString(
      raw.type,
      `contact.urls[${index}].type`,
      LIMITS.urlType,
    );
    if (!URL_TYPE_RE.test(type)) {
      throw new Error(`contact.urls[${index}].type must be letters and digits only`);
    }
  }
  return type === undefined ? { url } : { url, type };
}

function parseContact(raw: unknown): CardLoadInput["contact"] {
  if (!isRecord(raw)) {
    throw new Error("contact must be an object");
  }
  assertAllowedKeys(
    raw,
    ["name", "org", "title", "email", "phone", "vcardNote", "urls"],
    "contact",
  );
  const email = requireEmail(
    requireNonWhitespaceString(raw.email, "contact.email", LIMITS.contactEmail),
    "contact.email",
  );
  if (!Array.isArray(raw.urls)) {
    throw new Error("contact.urls must be an array");
  }
  if (raw.urls.length < 1 || raw.urls.length > LIMITS.contactUrls) {
    throw new Error(`contact.urls must have 1–${LIMITS.contactUrls} items`);
  }
  return {
    name: parseContactName(raw.name),
    org: requireNonWhitespaceString(raw.org, "contact.org", LIMITS.contactField),
    title: requireNonWhitespaceString(raw.title, "contact.title", LIMITS.contactField),
    email,
    phone: requireNonWhitespaceString(raw.phone, "contact.phone", LIMITS.contactPhone),
    vcardNote: requireNonWhitespaceString(
      raw.vcardNote,
      "contact.vcardNote",
      LIMITS.contactField,
    ),
    urls: raw.urls.map((item, index) => parseContactUrl(item, index)),
  };
}

function parsePageCopy(raw: unknown): CardLoadInput["pageCopy"] {
  if (!isRecord(raw)) {
    throw new Error("pageCopy must be an object");
  }
  const keys = [
    "pageTitle",
    "emailFromName",
    "headshotAlt",
    "greetingName",
    "exchangeButton",
    "bookLink",
  ];
  assertAllowedKeys(raw, keys, "pageCopy");
  return {
    pageTitle: requireNonWhitespaceString(
      raw.pageTitle,
      "pageCopy.pageTitle",
      LIMITS.pageCopyField,
    ),
    emailFromName: requireNonWhitespaceString(
      raw.emailFromName,
      "pageCopy.emailFromName",
      LIMITS.pageCopyField,
    ),
    headshotAlt: requireNonWhitespaceString(
      raw.headshotAlt,
      "pageCopy.headshotAlt",
      LIMITS.pageCopyField,
    ),
    greetingName: requireNonWhitespaceString(
      raw.greetingName,
      "pageCopy.greetingName",
      LIMITS.pageCopyField,
    ),
    exchangeButton: requireNonWhitespaceString(
      raw.exchangeButton,
      "pageCopy.exchangeButton",
      LIMITS.pageCopyField,
    ),
    bookLink:
      raw.bookLink === undefined
        ? undefined
        : requireNonWhitespaceString(
            raw.bookLink,
            "pageCopy.bookLink",
            LIMITS.pageCopyField,
          ),
  };
}

function parseStringArray(
  raw: unknown,
  field: string,
  minItems: number,
  maxItems: number,
  maxItemLength: number,
  copyStrings: boolean,
): string[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${field} must be an array`);
  }
  if (raw.length < minItems) {
    throw new Error(`${field} must have at least ${minItems} item(s)`);
  }
  if (raw.length > maxItems) {
    throw new Error(`${field} exceeds max length ${maxItems}`);
  }
  return raw.map((item, index) =>
    copyStrings
      ? requireCopyString(item, `${field}[${index}]`, maxItemLength)
      : requireNonWhitespaceString(item, `${field}[${index}]`, maxItemLength),
  );
}

function parseAbout(raw: unknown): CardCopy["about"] {
  if (!isRecord(raw)) {
    throw new Error("copy.about must be an object");
  }
  assertAllowedKeys(
    raw,
    [
      "title",
      "intro",
      "expandedParagraphs",
      "consultationHighlight",
      "showMore",
      "showLess",
      "whatIDoTitle",
      "chips",
    ],
    "copy.about",
  );
  const chipsRaw = raw.chips;
  if (!Array.isArray(chipsRaw)) {
    throw new Error("copy.about.chips must be an array");
  }
  if (chipsRaw.length < 1) {
    throw new Error("copy.about.chips must have at least 1 item(s)");
  }
  if (chipsRaw.length > LIMITS.chips) {
    throw new Error(`copy.about.chips exceeds max length ${LIMITS.chips}`);
  }
  const chips = chipsRaw.map((chip, index) => {
    if (!isRecord(chip)) {
      throw new Error(`copy.about.chips[${index}] must be an object`);
    }
    assertAllowedKeys(chip, ["label", "explanation"], `copy.about.chips[${index}]`);
    return {
      label: requireCopyString(
        chip.label,
        `copy.about.chips[${index}].label`,
        LIMITS.chipLabel,
      ),
      explanation: requireCopyString(
        chip.explanation,
        `copy.about.chips[${index}].explanation`,
        LIMITS.chipExplanation,
      ),
    };
  });
  return {
    title: requireCopyString(raw.title, "copy.about.title"),
    intro: requireCopyString(raw.intro, "copy.about.intro"),
    expandedParagraphs: parseStringArray(
      raw.expandedParagraphs,
      "copy.about.expandedParagraphs",
      1,
      LIMITS.expandedParagraphs,
      LIMITS.copyLeaf,
      true,
    ),
    consultationHighlight: requireCopyString(
      raw.consultationHighlight,
      "copy.about.consultationHighlight",
    ),
    showMore: requireCopyString(raw.showMore, "copy.about.showMore"),
    showLess: requireCopyString(raw.showLess, "copy.about.showLess"),
    whatIDoTitle: requireCopyString(raw.whatIDoTitle, "copy.about.whatIDoTitle"),
    chips,
  };
}

function parseExchangeSheetErrors(raw: unknown): CardCopy["exchangeSheet"]["errors"] {
  if (!isRecord(raw)) {
    throw new Error("copy.exchangeSheet.errors must be an object");
  }
  assertAllowedKeys(
    raw,
    ["nameRequired", "emailRequired", "emailInvalid"],
    "copy.exchangeSheet.errors",
  );
  return {
    nameRequired: requireCopyString(
      raw.nameRequired,
      "copy.exchangeSheet.errors.nameRequired",
    ),
    emailRequired: requireCopyString(
      raw.emailRequired,
      "copy.exchangeSheet.errors.emailRequired",
    ),
    emailInvalid: requireCopyString(
      raw.emailInvalid,
      "copy.exchangeSheet.errors.emailInvalid",
    ),
  };
}

function parseExchangeSheet(raw: unknown): CardCopy["exchangeSheet"] {
  if (!isRecord(raw)) {
    throw new Error("copy.exchangeSheet must be an object");
  }
  const keys = [
    "exchangeTitle",
    "detailsTitle",
    "detailsIntro",
    "nameLabel",
    "emailLabel",
    "phoneLabel",
    "phoneOptional",
    "countryCodeAriaLabel",
    "submitExchange",
    "submitDetails",
    "consent",
    "closeLabel",
    "exchangeFormAriaLabel",
    "detailsFormAriaLabel",
    "notePlaceholder",
    "jobTitleLabel",
    "companyLabel",
    "noteLabel",
    "pendingExchange",
    "pendingDetails",
    "detailsSaved",
    "networkErrorMessage",
    "exchangeNotSavedPrefix",
    "exchangeNotSavedEmail",
    "exchangeNotSavedSuffix",
    "errors",
  ];
  assertAllowedKeys(raw, keys, "copy.exchangeSheet");
  const exchangeNotSavedEmail = requireEmail(
    requireNonWhitespaceString(
      raw.exchangeNotSavedEmail,
      "copy.exchangeSheet.exchangeNotSavedEmail",
      LIMITS.email,
    ),
    "copy.exchangeSheet.exchangeNotSavedEmail",
  );
  return {
    exchangeTitle: requireCopyString(
      raw.exchangeTitle,
      "copy.exchangeSheet.exchangeTitle",
    ),
    detailsTitle: requireCopyString(
      raw.detailsTitle,
      "copy.exchangeSheet.detailsTitle",
    ),
    detailsIntro: requireCopyString(
      raw.detailsIntro,
      "copy.exchangeSheet.detailsIntro",
    ),
    nameLabel: requireCopyString(raw.nameLabel, "copy.exchangeSheet.nameLabel"),
    emailLabel: requireCopyString(raw.emailLabel, "copy.exchangeSheet.emailLabel"),
    phoneLabel: requireCopyString(raw.phoneLabel, "copy.exchangeSheet.phoneLabel"),
    phoneOptional: requireCopyString(
      raw.phoneOptional,
      "copy.exchangeSheet.phoneOptional",
    ),
    countryCodeAriaLabel: requireCopyString(
      raw.countryCodeAriaLabel,
      "copy.exchangeSheet.countryCodeAriaLabel",
    ),
    submitExchange: requireCopyString(
      raw.submitExchange,
      "copy.exchangeSheet.submitExchange",
    ),
    submitDetails: requireCopyString(
      raw.submitDetails,
      "copy.exchangeSheet.submitDetails",
    ),
    consent: requireCopyString(raw.consent, "copy.exchangeSheet.consent"),
    closeLabel: requireCopyString(raw.closeLabel, "copy.exchangeSheet.closeLabel"),
    exchangeFormAriaLabel: requireCopyString(
      raw.exchangeFormAriaLabel,
      "copy.exchangeSheet.exchangeFormAriaLabel",
    ),
    detailsFormAriaLabel: requireCopyString(
      raw.detailsFormAriaLabel,
      "copy.exchangeSheet.detailsFormAriaLabel",
    ),
    notePlaceholder: requireCopyString(
      raw.notePlaceholder,
      "copy.exchangeSheet.notePlaceholder",
    ),
    jobTitleLabel: requireCopyString(
      raw.jobTitleLabel,
      "copy.exchangeSheet.jobTitleLabel",
    ),
    companyLabel: requireCopyString(
      raw.companyLabel,
      "copy.exchangeSheet.companyLabel",
    ),
    noteLabel: requireCopyString(raw.noteLabel, "copy.exchangeSheet.noteLabel"),
    pendingExchange: requireCopyString(
      raw.pendingExchange,
      "copy.exchangeSheet.pendingExchange",
    ),
    pendingDetails: requireCopyString(
      raw.pendingDetails,
      "copy.exchangeSheet.pendingDetails",
    ),
    detailsSaved: requireCopyString(
      raw.detailsSaved,
      "copy.exchangeSheet.detailsSaved",
    ),
    networkErrorMessage: requireCopyString(
      raw.networkErrorMessage,
      "copy.exchangeSheet.networkErrorMessage",
    ),
    exchangeNotSavedPrefix: requireCopyString(
      raw.exchangeNotSavedPrefix,
      "copy.exchangeSheet.exchangeNotSavedPrefix",
    ),
    exchangeNotSavedEmail,
    exchangeNotSavedSuffix: requireCopyString(
      raw.exchangeNotSavedSuffix,
      "copy.exchangeSheet.exchangeNotSavedSuffix",
    ),
    errors: parseExchangeSheetErrors(raw.errors),
  };
}

function parseCopy(raw: unknown): CardCopy {
  if (!isRecord(raw)) {
    throw new Error("copy must be an object");
  }
  if (raw.followUpEmail !== undefined) {
    console.warn(
      "copy.followUpEmail is ignored (follow-up email copy is fixed in v1); remove it from the card file",
    );
  }
  const copyInput = { ...raw };
  delete copyInput.followUpEmail;
  assertAllowedKeys(
    copyInput,
    ["thanksMessage", "exchangeAriaLabel", "footerNavLabel", "about", "exchangeSheet"],
    "copy",
  );
  return {
    thanksMessage: requireCopyString(copyInput.thanksMessage, "copy.thanksMessage"),
    exchangeAriaLabel: requireCopyString(
      copyInput.exchangeAriaLabel,
      "copy.exchangeAriaLabel",
    ),
    footerNavLabel: requireCopyString(copyInput.footerNavLabel, "copy.footerNavLabel"),
    about: parseAbout(copyInput.about),
    exchangeSheet: parseExchangeSheet(copyInput.exchangeSheet),
  };
}

function parseCard(raw: unknown, seenSinkIds: Set<string>): CardLoadInput {
  if (!isRecord(raw)) {
    throw new Error("Each card must be an object");
  }
  assertAllowedKeys(
    raw,
    [
      "slug",
      "variant",
      "displayName",
      "email",
      "photoKey",
      "links",
      "pageCopy",
      "contact",
      "copy",
      "leadSinks",
    ],
    "card",
  );
  const slug = requireNonWhitespaceString(raw.slug, "slug", 64);
  assertValidSlug(slug);
  const variant = requireNonWhitespaceString(raw.variant, "variant", 16);
  if (!VARIANTS.has(variant as BrandVariant)) {
    throw new Error(`Invalid variant: ${variant}`);
  }
  const photoKey =
    raw.photoKey === null
      ? null
      : typeof raw.photoKey === "string"
        ? (() => {
            if (!/\S/.test(raw.photoKey as string)) {
              throw new Error("photoKey must contain non-whitespace text");
            }
            assertNoControlCharacters(raw.photoKey as string, "photoKey");
            if ((raw.photoKey as string).length > LIMITS.photoKey) {
              throw new Error(`photoKey exceeds max length ${LIMITS.photoKey}`);
            }
            return raw.photoKey as string;
          })()
        : (() => {
            throw new Error("photoKey must be a string or null");
          })();

  const leadSinks = parseLeadSinksField(raw.leadSinks, slug, seenSinkIds);
  const links = parseLinks(raw.links);
  const pageCopy = parsePageCopy(raw.pageCopy);
  if (links.bookingUrl && !pageCopy.bookLink) {
    throw new Error("pageCopy.bookLink is required when links.bookingUrl is set");
  }
  if (!links.bookingUrl && pageCopy.bookLink) {
    throw new Error("links.bookingUrl is required when pageCopy.bookLink is set");
  }

  return {
    slug,
    variant: variant as BrandVariant,
    displayName: requireNonWhitespaceString(
      raw.displayName,
      "displayName",
      LIMITS.displayName,
    ),
    email: requireEmail(
      requireNonWhitespaceString(raw.email, "email", LIMITS.email),
      "email",
    ),
    photoKey,
    links,
    pageCopy,
    contact: parseContact(raw.contact),
    copy: parseCopy(raw.copy),
    ...(leadSinks === undefined ? {} : { leadSinks }),
  };
}

function parseLeadSinksField(
  raw: unknown,
  slug: string,
  seenSinkIds: Set<string>,
): LeadSinkLoadInput[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    throw new Error(`Card "${slug}" leadSinks must be an array`);
  }
  if (raw.length > MAX_LEAD_SINKS_PER_CARD) {
    throw new Error(
      `Card "${slug}" has more than ${MAX_LEAD_SINKS_PER_CARD} lead sinks`,
    );
  }
  const sinks = raw.map((entry, index) =>
    parseLeadSinkEntry(entry, slug, index, seenSinkIds),
  );
  const emailCount = sinks.filter((s) => s.kind === "email").length;
  if (emailCount > MAX_EMAIL_SINKS_PER_CARD) {
    throw new Error(
      `Card "${slug}" has more than ${MAX_EMAIL_SINKS_PER_CARD} email lead sinks`,
    );
  }
  return sinks;
}

function parseLeadSinkEntry(
  raw: unknown,
  slug: string,
  index: number,
  seenSinkIds: Set<string>,
): LeadSinkLoadInput {
  if (!isRecord(raw)) {
    throw new Error(`Card "${slug}" leadSinks[${index}] must be an object`);
  }
  assertAllowedKeys(raw, ["id", "kind", "enabled", "config"], `leadSinks[${index}]`);
  const id = requireNonWhitespaceString(raw.id, `leadSinks[${index}].id`, 63);
  if (!LEAD_SINK_ID_PATTERN.test(id)) {
    throw new Error(
      `Card "${slug}" leadSinks[${index}].id must match ${LEAD_SINK_ID_PATTERN}`,
    );
  }
  const requiredIdPrefix = `${slug}-`;
  if (!id.startsWith(requiredIdPrefix)) {
    throw new Error(
      `Card "${slug}" leadSinks[${index}].id must start with "${requiredIdPrefix}"`,
    );
  }
  if (seenSinkIds.has(id)) {
    throw new Error(`Duplicate lead sink id "${id}" in load file`);
  }
  seenSinkIds.add(id);
  const kind = requireNonWhitespaceString(raw.kind, `leadSinks[${index}].kind`, 64);
  const enabled =
    raw.enabled === undefined
      ? true
      : (() => {
          if (typeof raw.enabled !== "boolean") {
            throw new Error(`leadSinks[${index}].enabled must be a boolean`);
          }
          return raw.enabled;
        })();
  if (raw.config === undefined) {
    throw new Error(`Card "${slug}" leadSinks[${index}] requires config`);
  }
  const config = parseLeadSinkConfig(kind, raw.config);
  return { id, kind, enabled, config };
}

function loadFileHasEmailSink(loadFile: CardsLoadFile): boolean {
  for (const card of loadFile.cards) {
    if (!card.leadSinks) {
      continue;
    }
    for (const sink of card.leadSinks) {
      if (sink.kind === "email") {
        return true;
      }
    }
  }
  return false;
}

export function validateNonProdEmailSinkDestinations(
  loadFile: CardsLoadFile,
  testMailTo: string,
): void {
  if (!loadFileHasEmailSink(loadFile)) {
    return;
  }
  const expected = testMailTo.trim();
  if (!expected) {
    throw new Error("WE_MET_TEST_MAIL_TO must be set for non-prod remote load");
  }
  for (const card of loadFile.cards) {
    if (!card.leadSinks) {
      continue;
    }
    for (const sink of card.leadSinks) {
      if (sink.kind !== "email") {
        continue;
      }
      const config = sink.config as { to?: string };
      if (config.to?.trim() !== expected) {
        throw new Error(
          `Non-prod load: email sink "${sink.id}" on card "${card.slug}" must use WE_MET_TEST_MAIL_TO as config.to`,
        );
      }
    }
  }
}

function parseHostnameMapping(raw: unknown): CardsLoadFile["hostnames"][number] {
  if (!isRecord(raw)) {
    throw new Error("Each hostname mapping must be an object");
  }
  assertAllowedKeys(raw, ["hostname", "slug"], "hostname mapping");
  const hostname = requireNonWhitespaceString(
    raw.hostname,
    "hostname",
    253,
  ).toLowerCase();
  assertValidHostname(hostname);
  const slug = requireNonWhitespaceString(raw.slug, "slug", 64);
  if (!isValidSlug(slug)) {
    throw new Error(`Invalid slug in hostname mapping: ${slug}`);
  }
  return { hostname, slug };
}

export function parseCardsLoadFile(raw: unknown): CardsLoadFile {
  registerBuiltInLeadSinkKinds();
  if (!isRecord(raw)) {
    throw new Error("Load file must be a JSON object");
  }
  if (raw.leadSinks !== undefined) {
    throw new Error(
      "leadSinks belong on each card object, not at the root of the load file",
    );
  }
  assertAllowedKeys(raw, ["cards", "hostnames"], "load file");
  if (!Array.isArray(raw.cards)) {
    throw new Error("Load file must include a cards array");
  }
  if (!Array.isArray(raw.hostnames)) {
    throw new Error("Load file must include a hostnames array");
  }
  const seenSinkIds = new Set<string>();
  return {
    cards: raw.cards.map((card) => parseCard(card, seenSinkIds)),
    hostnames: raw.hostnames.map(parseHostnameMapping),
  };
}
