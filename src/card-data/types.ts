export type BrandVariant = "green" | "mono";

export type FooterLink = {
  label: string;
  url: string;
};

export type ContactName = {
  full: string;
  family: string;
  given: string;
  nickname: string;
};

export type CardContact = {
  name: ContactName;
  org: string;
  title: string;
  email: string;
  phone: string;
  vcardNote: string;
};

export type CardPageCopy = {
  pageTitle: string;
  emailFromName: string;
  headshotAlt: string;
  greetingName: string;
  exchangeButton: string;
  bookLink: string;
};

export type CardExchangeCopy = Record<string, unknown>;

export type CardRecord = {
  id: string;
  slug: string;
  variant: BrandVariant;
  displayName: string;
  email: string;
  photoKey: string | null;
  footerLink: FooterLink;
  pageCopy: CardPageCopy;
  contact: CardContact;
  exchangeCopy: CardExchangeCopy;
  updatedAt: string;
};

export type LeadSinkRecord = {
  id: string;
  cardId: string;
  kind: string;
  config: unknown;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CardLoadInput = {
  slug: string;
  variant: BrandVariant;
  displayName: string;
  email: string;
  photoKey: string | null;
  footerLink: FooterLink;
  pageCopy: CardPageCopy;
  contact: CardContact;
  exchangeCopy: CardExchangeCopy;
};

export type HostnameMapping = {
  hostname: string;
  slug: string;
};

export type CardsLoadFile = {
  cards: CardLoadInput[];
  hostnames: HostnameMapping[];
};
