import type {
  BrandVariant,
  CardAbout,
  CardAlternate,
  CardBookingLinks,
  CardContact,
  CardCopy,
  CardLoadInput,
  CardPageCopy,
  CardPublicLinksMap,
  CardRecord,
  CardServices,
} from "@/card-data/types";
import { normalizeBrandVariant } from "@/card-data/normalize-variant";

export type CardPageCopyStored = CardPageCopy & {
  name: string;
  role?: string;
  about?: CardAbout;
  services?: CardServices;
  links?: CardPublicLinksMap;
  alternate?: CardAlternate;
};

export type CardLinksStored = CardBookingLinks;

function normalizeAboutFromLegacy(
  pageStored: CardPageCopyStored,
): CardAbout | undefined {
  if (
    pageStored.about &&
    Array.isArray((pageStored.about as { paragraphs?: unknown }).paragraphs)
  ) {
    return pageStored.about as CardAbout;
  }
  const legacyTitle = (pageStored as { aboutTitle?: string }).aboutTitle;
  const legacyParas = (pageStored as { about?: string[] }).about;
  if (legacyTitle && Array.isArray(legacyParas) && legacyParas.some((p) => p?.trim())) {
    return { title: legacyTitle, paragraphs: legacyParas.filter((p) => p?.trim()) };
  }
  return undefined;
}

function normalizeServicesFromLegacy(
  pageStored: CardPageCopyStored,
): CardServices | undefined {
  if (
    pageStored.services &&
    Array.isArray((pageStored.services as CardServices).items)
  ) {
    return pageStored.services as CardServices;
  }
  const legacyTitle = (pageStored as { servicesTitle?: string }).servicesTitle;
  const legacyItems = (
    pageStored as { services?: { label: string; description: string }[] }
  ).services;
  if (legacyItems?.length) {
    return {
      title: legacyTitle ?? "What I do",
      items: legacyItems
        .filter((s) => s?.label?.trim())
        .map((s) => ({ title: s.label, description: s.description ?? "" })),
    };
  }
  return undefined;
}

function normalizeLinksFromLegacy(
  pageStored: CardPageCopyStored,
  linksStored: CardLinksStored & { items?: { type: string; url: string }[] },
): CardPublicLinksMap | undefined {
  if (
    pageStored.links &&
    typeof pageStored.links === "object" &&
    !Array.isArray(pageStored.links)
  ) {
    return pageStored.links;
  }
  const items = linksStored.items;
  if (!items?.length) {
    return undefined;
  }
  const map: CardPublicLinksMap = {};
  for (const item of items) {
    if (item.type === "website") map.website = item.url;
    if (item.type === "linkedin") map.linkedin = item.url;
    if (item.type === "github") map.github = item.url;
    if (item.type === "instagram") map.instagram = item.url;
  }
  return Object.keys(map).length ? map : undefined;
}

function normalizeAlternateFromLegacy(
  pageStored: CardPageCopyStored,
  linksStored: CardLinksStored & { fallbackUrl?: string },
): CardAlternate | undefined {
  if (pageStored.alternate?.url && pageStored.alternate?.label) {
    return pageStored.alternate;
  }
  const fallbackUrl = linksStored.fallbackUrl;
  const fallbackLabel = (pageStored as { fallbackLabel?: string }).fallbackLabel;
  if (fallbackUrl?.trim() && fallbackLabel?.trim()) {
    return { url: fallbackUrl, label: fallbackLabel };
  }
  return undefined;
}

function contactFromStored(raw: CardContact & { email?: string }): CardContact {
  const { email: _ignoredLegacyEmail, ...contact } = raw;
  void _ignoredLegacyEmail;
  return contact;
}

export function cardLoadInputToPersisted(input: CardLoadInput): {
  pageCopy: CardPageCopyStored;
  links: CardLinksStored;
  contact: CardContact;
  copy: CardCopy;
} {
  const { pageCopy, bookingLinks, contact, copy, ...content } = input;
  return {
    pageCopy: {
      ...pageCopy,
      name: content.name,
      role: content.role,
      about: content.about,
      services: content.services,
      links: content.links,
      alternate: content.alternate,
    },
    links: { bookingUrl: bookingLinks.bookingUrl },
    contact: contactFromStored(contact as CardContact & { email?: string }),
    copy,
  };
}

export function cardRowToRecord(
  row: {
    id: string;
    slug: string;
    variant: string;
    display_name: string;
    account_id: string;
    status: string;
    owner_email: string;
    photo_key: string | null;
    links_json: string;
    page_copy_json: string;
    contact_json: string;
    copy_json: string;
    updated_at: string;
  },
  parseJson: <T>(label: string, raw: string) => T,
): CardRecord {
  const pageStored = parseJson<CardPageCopyStored>("page_copy", row.page_copy_json);
  const linksStored = parseJson<
    CardLinksStored & { items?: { type: string; url: string }[]; fallbackUrl?: string }
  >("links", row.links_json);
  const contact = contactFromStored(
    parseJson<CardContact & { email?: string }>("contact", row.contact_json),
  );
  const copy = parseJson<CardCopy>("copy", row.copy_json);

  const about = normalizeAboutFromLegacy(pageStored);
  const services = normalizeServicesFromLegacy(pageStored);
  const links = normalizeLinksFromLegacy(pageStored, linksStored);
  const alternate = normalizeAlternateFromLegacy(pageStored, linksStored);

  const status = row.status;
  if (status !== "live" && status !== "suspended" && status !== "retired") {
    throw new Error(`Invalid card status in database: ${status}`);
  }

  return {
    id: row.id,
    accountId: row.account_id,
    status,
    slug: row.slug,
    variant: normalizeBrandVariant(row.variant),
    displayName: row.display_name,
    email: row.owner_email,
    photoKey: row.photo_key,
    name: pageStored.name ?? row.display_name,
    role: pageStored.role,
    about,
    services,
    links,
    alternate,
    bookingLinks: {
      bookingUrl: linksStored.bookingUrl ?? alternate?.url ?? "",
    },
    pageCopy: {
      pageTitle: pageStored.pageTitle,
      emailFromName: pageStored.emailFromName,
      headshotAlt: pageStored.headshotAlt,
    },
    contact,
    copy,
    updatedAt: row.updated_at,
  };
}

export function cardLoadInputFromPersisted(
  slug: string,
  variant: BrandVariant,
  displayName: string,
  ownerEmail: string,
  photoKey: string | null,
  pageStored: CardPageCopyStored,
  linksStored: CardLinksStored,
  contact: CardContact,
  copy: CardCopy,
): CardLoadInput {
  const about = normalizeAboutFromLegacy(pageStored);
  const services = normalizeServicesFromLegacy(pageStored);
  const links = normalizeLinksFromLegacy(pageStored, linksStored);
  const alternate = normalizeAlternateFromLegacy(pageStored, linksStored);

  return {
    slug,
    variant,
    displayName,
    email: ownerEmail,
    photoKey,
    name: pageStored.name,
    role: pageStored.role,
    about,
    services,
    links,
    alternate,
    bookingLinks: {
      bookingUrl: linksStored.bookingUrl ?? alternate?.url ?? "",
    },
    pageCopy: {
      pageTitle: pageStored.pageTitle,
      emailFromName: pageStored.emailFromName,
      headshotAlt: pageStored.headshotAlt,
    },
    contact,
    copy,
  };
}
