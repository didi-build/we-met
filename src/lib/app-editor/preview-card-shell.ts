import type { CardCopy, CardPageCopy, CardRecord } from "@/card-data/types";

/** Static visitor copy for editor preview only (exchange is disabled). */
export const PREVIEW_CARD_COPY: CardCopy = {
  thanksMessage: "Thanks, {firstName}. Talk soon.",
  exchangeAriaLabel: "Exchange contacts",
  footerNavLabel: "Elsewhere",
  exchangeSheet: {
    exchangeTitle: "Let's stay in touch",
    detailsTitle: "Nice to meet you, {firstName} 👋",
    detailsIntro: "Add a few details to help me remember you.",
    nameLabel: "Full name",
    emailLabel: "Email",
    phoneLabel: "Phone",
    phoneOptional: "(optional)",
    countryCodeAriaLabel: "Country code",
    submitExchange: "Exchange contact",
    submitDetails: "Save details",
    consent: "I agree to share my contact details.",
    closeLabel: "Close",
    exchangeFormAriaLabel: "Exchange contact form",
    detailsFormAriaLabel: "Optional details form",
    notePlaceholder: "Where we met, what you're working on",
    jobTitleLabel: "Job title",
    companyLabel: "Company",
    noteLabel: "Note",
    pendingExchange: "Sending…",
    pendingDetails: "Saving…",
    detailsSaved: "Details saved",
    networkErrorMessage: "Network error. Please try again.",
    exchangeNotSavedPrefix: "We could not save your details. Email ",
    exchangeNotSavedEmail: "help@didi.build",
    exchangeNotSavedSuffix: " and we'll connect you manually.",
    errors: {
      nameRequired: "Add your name so I know who you are.",
      emailRequired: "Add your email so I can reach you.",
      emailInvalid: "That email doesn't look quite right. Check for a typo?",
    },
  },
};

export const PREVIEW_PAGE_COPY: CardPageCopy = {
  pageTitle: "We Met",
  emailFromName: "We Met",
  headshotAlt: "Your photo",
};

export function previewCardShell(
  slug: string,
  name: string,
): Omit<CardRecord, "role" | "about" | "services" | "links" | "alternate"> {
  return {
    id: "preview",
    slug,
    variant: "mono",
    displayName: name || "Preview",
    email: "preview@we-met.link",
    name,
    bookingLinks: { bookingUrl: "https://we-met.link" },
    pageCopy: {
      ...PREVIEW_PAGE_COPY,
      pageTitle: name ? `${name} · We Met` : PREVIEW_PAGE_COPY.pageTitle,
      headshotAlt: name || PREVIEW_PAGE_COPY.headshotAlt,
    },
    contact: {
      name: { full: name, family: "", given: name, nickname: name },
      org: "",
      title: "",
      email: "preview@we-met.link",
      phone: "",
      vcardNote: "",
      urls: [],
    },
    copy: PREVIEW_CARD_COPY,
    updatedAt: new Date().toISOString(),
  };
}
