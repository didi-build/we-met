import { cardLoadInputToPersisted } from "@/card-data/card-persist";
import { assertValidHostname } from "@/card-data/hostname";
import {
  LEAD_SINK_ID_PATTERN,
  MAX_EMAIL_SINKS_PER_CARD,
  MAX_LEAD_SINKS_PER_CARD,
} from "@/card-data/load-limits";
import { assertNoControlCharacters } from "@/card-data/load-sql";
import { parseLeadSinkConfig } from "@/card-data/lead-sink-registry";
import { registerBuiltInLeadSinkKinds } from "@/card-data/register-lead-sink-kinds";
import { normalizeBrandVariant } from "@/card-data/normalize-variant";
import { assertValidSlug, isValidSlug } from "@/card-data/slug";
import type {
  CardCopy,
  CardLoadInput,
  CardPlan,
  CardPublicLink,
  CardPublicLinkType,
  CardService,
  CardsLoadFile,
  ContactUrl,
  LeadSinkLoadInput,
} from "@/card-data/types";

const LINK_TYPES = new Set<CardPublicLinkType>([
  "website",
  "linkedin",
  "github",
  "instagram",
]);

const PLANS = new Set<CardPlan>(["free", "pro"]);

const BASIC_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_TOKEN = /\{([^}]+)\}/g;
const URL_TYPE_RE = /^[a-zA-Z0-9]{1,30}$/;

const LIMITS = {
  name: 60,
  role: 100,
  sectionTitle: 40,
  aboutParagraphs: 4,
  aboutParagraph: 500,
  services: 6,
  serviceLabel: 40,
  serviceDescription: 220,
  links: 8,
  linkLabel: 40,
  fallbackLabel: 60,
  email: 254,
  photoKey: 256,
  pageCopyField: 500,
  contactField: 500,
  contactEmail: 254,
  contactPhone: 64,
  copyLeaf: 1000,
  url: 2048,
  bodyParagraphs: 6,
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

function optionalNonWhitespaceString(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return requireNonWhitespaceString(value, field, maxLength);
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

function optionalHttpsUrl(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const raw = requireNonWhitespaceString(value, field, LIMITS.url);
  return requireHttpsUrl(raw, field);
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

function parseStringArray(
  raw: unknown,
  field: string,
  minItems: number,
  maxItems: number,
  maxItemLength: number,
  copyStrings: boolean,
): string[] | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
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

function parseServices(raw: unknown): CardService[] | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    throw new Error("services must be an array");
  }
  if (raw.length > LIMITS.services) {
    throw new Error(`services exceeds max length ${LIMITS.services}`);
  }
  return raw.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`services[${index}] must be an object`);
    }
    assertAllowedKeys(item, ["label", "description"], `services[${index}]`);
    return {
      label: requireNonWhitespaceString(
        item.label,
        `services[${index}].label`,
        LIMITS.serviceLabel,
      ),
      description: requireNonWhitespaceString(
        item.description,
        `services[${index}].description`,
        LIMITS.serviceDescription,
      ),
    };
  });
}

function parsePublicLinks(raw: unknown): CardPublicLink[] | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (!Array.isArray(raw)) {
    throw new Error("links must be an array");
  }
  if (raw.length > LIMITS.links) {
    throw new Error(`links exceeds max length ${LIMITS.links}`);
  }
  return raw.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`links[${index}] must be an object`);
    }
    assertAllowedKeys(item, ["type", "label", "url"], `links[${index}]`);
    const type = requireNonWhitespaceString(item.type, `links[${index}].type`, 32);
    if (!LINK_TYPES.has(type as CardPublicLinkType)) {
      throw new Error(`Invalid link type: ${type}`);
    }
    const label = requireNonWhitespaceString(
      item.label,
      `links[${index}].label`,
      LIMITS.linkLabel,
    );
    const url = requireHttpsUrl(
      requireNonWhitespaceString(item.url, `links[${index}].url`, LIMITS.url),
      `links[${index}].url`,
    );
    return { type: type as CardPublicLinkType, label, url };
  });
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
  assertAllowedKeys(raw, ["pageTitle", "emailFromName", "headshotAlt"], "pageCopy");
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

function parseFollowUpEmail(raw: unknown): CardCopy["followUpEmail"] {
  if (!isRecord(raw)) {
    throw new Error("copy.followUpEmail must be an object");
  }
  assertAllowedKeys(
    raw,
    [
      "subjectTemplate",
      "greetingTemplate",
      "bodyParagraphs",
      "attachmentLine",
      "bookCtaLabel",
      "closingLine",
    ],
    "copy.followUpEmail",
  );
  return {
    subjectTemplate: requireCopyString(
      raw.subjectTemplate,
      "copy.followUpEmail.subjectTemplate",
    ),
    greetingTemplate: requireCopyString(
      raw.greetingTemplate,
      "copy.followUpEmail.greetingTemplate",
    ),
    bodyParagraphs:
      parseStringArray(
        raw.bodyParagraphs,
        "copy.followUpEmail.bodyParagraphs",
        1,
        LIMITS.bodyParagraphs,
        LIMITS.copyLeaf,
        true,
      ) ?? [],
    attachmentLine: requireCopyString(
      raw.attachmentLine,
      "copy.followUpEmail.attachmentLine",
    ),
    bookCtaLabel: requireCopyString(
      raw.bookCtaLabel,
      "copy.followUpEmail.bookCtaLabel",
    ),
    closingLine: requireCopyString(raw.closingLine, "copy.followUpEmail.closingLine"),
  };
}

function parseCopy(raw: unknown): CardCopy {
  if (!isRecord(raw)) {
    throw new Error("copy must be an object");
  }
  assertAllowedKeys(
    raw,
    [
      "thanksMessage",
      "exchangeAriaLabel",
      "footerNavLabel",
      "exchangeSheet",
      "followUpEmail",
    ],
    "copy",
  );
  return {
    thanksMessage: requireCopyString(raw.thanksMessage, "copy.thanksMessage"),
    exchangeAriaLabel: requireCopyString(
      raw.exchangeAriaLabel,
      "copy.exchangeAriaLabel",
    ),
    footerNavLabel: requireCopyString(raw.footerNavLabel, "copy.footerNavLabel"),
    exchangeSheet: parseExchangeSheet(raw.exchangeSheet),
    followUpEmail: parseFollowUpEmail(raw.followUpEmail),
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
      "plan",
      "name",
      "role",
      "photoKey",
      "aboutTitle",
      "about",
      "servicesTitle",
      "services",
      "linksTitle",
      "links",
      "fallbackUrl",
      "fallbackLabel",
      "email",
      "contact",
      "pageCopy",
      "copy",
      "leadSinks",
    ],
    "card",
  );
  const slug = requireNonWhitespaceString(raw.slug, "slug", 64);
  assertValidSlug(slug);
  const variantRaw = requireNonWhitespaceString(raw.variant, "variant", 16);
  const variant = normalizeBrandVariant(variantRaw);
  if (variantRaw !== variant && variantRaw !== "mono") {
    // unknown variants fall back to mono without error (per ticket)
  }

  let plan: CardPlan = "free";
  if (raw.plan !== undefined) {
    const planRaw = requireNonWhitespaceString(raw.plan, "plan", 8);
    if (!PLANS.has(planRaw as CardPlan)) {
      throw new Error(`Invalid plan: ${planRaw}`);
    }
    plan = planRaw as CardPlan;
  }

  const name = requireNonWhitespaceString(raw.name, "name", LIMITS.name);
  const role = optionalNonWhitespaceString(raw.role, "role", LIMITS.role);
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
        : raw.photoKey === undefined
          ? null
          : (() => {
              throw new Error("photoKey must be a string or null");
            })();

  const aboutTitle = optionalNonWhitespaceString(
    raw.aboutTitle,
    "aboutTitle",
    LIMITS.sectionTitle,
  );
  const about = parseStringArray(
    raw.about,
    "about",
    0,
    LIMITS.aboutParagraphs,
    LIMITS.aboutParagraph,
    false,
  );
  const servicesTitle = optionalNonWhitespaceString(
    raw.servicesTitle,
    "servicesTitle",
    LIMITS.sectionTitle,
  );
  const services = parseServices(raw.services);
  const linksTitle = optionalNonWhitespaceString(
    raw.linksTitle,
    "linksTitle",
    LIMITS.sectionTitle,
  );
  const publicLinks = parsePublicLinks(raw.links);
  const fallbackUrl = optionalHttpsUrl(raw.fallbackUrl, "fallbackUrl");
  const fallbackLabel = optionalNonWhitespaceString(
    raw.fallbackLabel,
    "fallbackLabel",
    LIMITS.fallbackLabel,
  );

  const leadSinks = parseLeadSinksField(raw.leadSinks, slug, seenSinkIds);

  const input: CardLoadInput = {
    slug,
    variant,
    plan,
    displayName: name,
    email: requireEmail(
      requireNonWhitespaceString(raw.email, "email", LIMITS.email),
      "email",
    ),
    photoKey,
    name,
    role,
    aboutTitle,
    about,
    servicesTitle,
    services,
    linksTitle,
    publicLinks,
    fallbackUrl,
    fallbackLabel,
    links: {
      bookingUrl: fallbackUrl ?? "",
      items: publicLinks ?? [],
    },
    pageCopy: parsePageCopy(raw.pageCopy),
    contact: parseContact(raw.contact),
    copy: parseCopy(raw.copy),
    ...(leadSinks === undefined ? {} : { leadSinks }),
  };

  cardLoadInputToPersisted(input);
  return input;
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
