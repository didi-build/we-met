export type BrandVariant = "green" | "mono";

export type FooterLinkKind = "site" | "linkedin" | "github" | "portfolio" | "google";

export type CardFooterLink = {
  kind: FooterLinkKind;
  label: string;
  url: string;
};

export type CardLinks = {
  bookingUrl: string;
  footer: CardFooterLink[];
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
  email: string;
  phone: string;
  vcardNote: string;
  urls: ContactUrl[];
};

export type CardPageCopy = {
  pageTitle: string;
  emailFromName: string;
  headshotAlt: string;
  greetingName: string;
  exchangeButton: string;
  bookLink: string;
};

export type CardCopyAboutChip = {
  label: string;
  explanation: string;
};

export type CardCopyAbout = {
  title: string;
  intro: string;
  expandedParagraphs: string[];
  consultationHighlight: string;
  showMore: string;
  showLess: string;
  whatIDoTitle: string;
  chips: CardCopyAboutChip[];
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

export type CardCopyFollowUpEmail = {
  subjectTemplate: string;
  greetingTemplate: string;
  bodyParagraphs: string[];
  attachmentLine: string;
  bookCtaLabel: string;
  closingLine: string;
};

export type CardCopy = {
  thanksMessage: string;
  exchangeAriaLabel: string;
  footerNavLabel: string;
  about: CardCopyAbout;
  exchangeSheet: CardCopyExchangeSheet;
  followUpEmail: CardCopyFollowUpEmail;
};

export type CardRecord = {
  id: string;
  slug: string;
  variant: BrandVariant;
  displayName: string;
  email: string;
  photoKey: string | null;
  links: CardLinks;
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

export type CardLoadInput = {
  slug: string;
  variant: BrandVariant;
  displayName: string;
  email: string;
  photoKey: string | null;
  links: CardLinks;
  pageCopy: CardPageCopy;
  contact: CardContact;
  copy: CardCopy;
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
