import type {
  BrandVariant,
  CardBookingLinks,
  CardContact,
  CardCopy,
  CardLoadInput,
  CardPageCopy,
  CardPlan,
  CardRecord,
  CardService,
} from "@/card-data/types";
import { normalizeBrandVariant } from "@/card-data/normalize-variant";

export type CardPageCopyStored = CardPageCopy & {
  plan: CardPlan;
  name: string;
  role?: string;
  aboutTitle?: string;
  about?: string[];
  servicesTitle?: string;
  services?: CardService[];
  linksTitle?: string;
  fallbackLabel?: string;
};

export type CardLinksStored = CardBookingLinks & {
  fallbackUrl?: string;
};

export function cardLoadInputToPersisted(input: CardLoadInput): {
  pageCopy: CardPageCopyStored;
  links: CardLinksStored;
  contact: CardContact;
  copy: CardCopy;
} {
  const { pageCopy, links, contact, copy, ...content } = input;
  return {
    pageCopy: {
      ...pageCopy,
      plan: content.plan,
      name: content.name,
      role: content.role,
      aboutTitle: content.aboutTitle,
      about: content.about,
      servicesTitle: content.servicesTitle,
      services: content.services,
      linksTitle: content.linksTitle,
      fallbackLabel: content.fallbackLabel,
    },
    links: {
      bookingUrl: links.bookingUrl,
      items: links.items,
      fallbackUrl: content.fallbackUrl,
    },
    contact,
    copy,
  };
}

export function cardRowToRecord(
  row: {
    id: string;
    slug: string;
    variant: string;
    display_name: string;
    email: string;
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
  const linksStored = parseJson<CardLinksStored>("links", row.links_json);
  const contact = parseJson<CardContact>("contact", row.contact_json);
  const copy = parseJson<CardCopy>("copy", row.copy_json);

  const publicLinks = linksStored.items?.length ? linksStored.items : undefined;

  return {
    id: row.id,
    slug: row.slug,
    variant: normalizeBrandVariant(row.variant),
    plan: pageStored.plan ?? "free",
    displayName: row.display_name,
    email: row.email,
    photoKey: row.photo_key,
    name: pageStored.name ?? row.display_name,
    role: pageStored.role,
    aboutTitle: pageStored.aboutTitle,
    about: pageStored.about,
    servicesTitle: pageStored.servicesTitle,
    services: pageStored.services,
    linksTitle: pageStored.linksTitle,
    publicLinks,
    fallbackUrl: linksStored.fallbackUrl,
    fallbackLabel: pageStored.fallbackLabel,
    links: {
      bookingUrl: linksStored.bookingUrl,
      items: linksStored.items ?? [],
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
  email: string,
  photoKey: string | null,
  pageStored: CardPageCopyStored,
  linksStored: CardLinksStored,
  contact: CardContact,
  copy: CardCopy,
): CardLoadInput {
  return {
    slug,
    variant,
    plan: pageStored.plan ?? "free",
    displayName,
    email,
    photoKey,
    name: pageStored.name,
    role: pageStored.role,
    aboutTitle: pageStored.aboutTitle,
    about: pageStored.about,
    servicesTitle: pageStored.servicesTitle,
    services: pageStored.services,
    linksTitle: pageStored.linksTitle,
    publicLinks: linksStored.items,
    fallbackUrl: linksStored.fallbackUrl,
    fallbackLabel: pageStored.fallbackLabel,
    links: {
      bookingUrl: linksStored.bookingUrl,
      items: linksStored.items ?? [],
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
