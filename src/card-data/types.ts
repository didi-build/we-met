/** Values storable in D1 `cards.variant` (see migrations/0001). */
export type BrandVariant = "green" | "mono";

export type CardPlan = "free" | "pro";

/** @deprecated Legacy footer kinds; not used on the v1 public card. */
export type FooterLinkKind = "site" | "linkedin" | "github" | "portfolio" | "google";

export type CardPublicLinkType = "website" | "linkedin" | "github" | "instagram";

export type CardPublicLinksMap = {
  website?: string;
  linkedin?: string;
  github?: string;
  instagram?: string;
};

export type CardAlternate = {
  url: string;
  label: string;
};

export type CardAbout = {
  title: string;
  paragraphs: string[];
};

export type CardServiceItem = {
  title: string;
  description: string;
};

export type CardServices = {
  title: string;
  items: CardServiceItem[];
};

/** Persisted booking URL for legacy rows; not used in v1 visitor email snapshot. */
export type CardBookingLinks = {
  bookingUrl: string;
};

export type ContactName = {
  full: string;
  family: string;
  given: string;
  nickname: string;
};

export type ContactUrl = {
  url: string;
  type?: string;
};

export type CardContact = {
  name: ContactName;
  org: string;
  title: string;
  phone: string;
  vcardNote: string;
  urls: ContactUrl[];
};

export type CardPageCopy = {
  pageTitle: string;
  emailFromName: string;
  headshotAlt: string;
};

export type CardCopyExchangeSheetErrors = {
  nameRequired: string;
  emailRequired: string;
  emailInvalid: string;
};

export type CardCopyExchangeSheet = {
  exchangeTitle: string;
  detailsTitle: string;
  detailsIntro: string;
  nameLabel: string;
  emailLabel: string;
  phoneLabel: string;
  phoneOptional: string;
  countryCodeAriaLabel: string;
  submitExchange: string;
  submitDetails: string;
  consent: string;
  closeLabel: string;
  exchangeFormAriaLabel: string;
  detailsFormAriaLabel: string;
  notePlaceholder: string;
  jobTitleLabel: string;
  companyLabel: string;
  noteLabel: string;
  pendingExchange: string;
  pendingDetails: string;
  detailsSaved: string;
  networkErrorMessage: string;
  exchangeNotSavedPrefix: string;
  exchangeNotSavedEmail: string;
  exchangeNotSavedSuffix: string;
  errors: CardCopyExchangeSheetErrors;
};

export type CardCopy = {
  thanksMessage: string;
  exchangeAriaLabel: string;
  footerNavLabel: string;
  exchangeSheet: CardCopyExchangeSheet;
};

export type CardStatus = "live" | "suspended" | "retired";

export type CardRecord = {
  id: string;
  accountId: string;
  status: CardStatus;
  slug: string;
  variant: BrandVariant;
  displayName: string;
  /** Owner inbox from accounts.email (not stored on cards or in contact_json). */
  email: string;
  photoKey: string | null;
  name: string;
  role?: string;
  about?: CardAbout;
  services?: CardServices;
  links?: CardPublicLinksMap;
  alternate?: CardAlternate;
  bookingLinks: CardBookingLinks;
  pageCopy: CardPageCopy;
  contact: CardContact;
  copy: CardCopy;
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

export type LeadSinkLoadInput = {
  id: string;
  kind: string;
  enabled: boolean;
  config: unknown;
};

export type CardLoadInput = Omit<
  CardRecord,
  "id" | "updatedAt" | "status" | "accountId"
> & {
  status?: CardStatus;
  /** When omitted, cards:load creates a fixture account from the card email. */
  accountId?: string;
  /** When omitted, load script leaves existing sink rows unchanged for this card. */
  leadSinks?: LeadSinkLoadInput[];
};

export type HostnameMapping = {
  hostname: string;
  slug: string;
};

export type CardsLoadFile = {
  cards: CardLoadInput[];
  hostnames: HostnameMapping[];
};
