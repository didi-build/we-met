import type { CardCopy } from "@/card-data/types";

/** Visitor confirmation receipt copy (Variant C, DIDI-742). */
export const VISITOR_RECEIPT_COPY = {
  sentTo: "Sent to {ownerFirst}",
  receiptTimeNow: "Just now",
  receiptTimeWithNote: "With your note",
  saveContact: "Save {ownerFirst}'s contact",
  saveBusy: "Preparing contact",
  saveDone: "Saved, tap to save again",
  emailLink: "Email",
  callLink: "Call",
  followUp: "{ownerFirst} will follow up by email.",
  tellMore: "Tell {ownerFirst} more about you",
  afterDetails: "Your details were added. Thanks, {visitorFirst}.",
  reloadFollowUp: "{ownerFirst} has your details and will follow up by email.",
} as const;

/** Default visitor exchange copy for newly published MVP cards (mono variant). */
export const DEFAULT_MVP_CARD_COPY: CardCopy = {
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
    exchangeNotSavedEmail: "hello@we-met.link",
    exchangeNotSavedSuffix: " and we'll connect you manually.",
    errors: {
      nameRequired: "Add your name so I know who you are.",
      emailRequired: "Add your email so I can reach you.",
      emailInvalid: "That email doesn't look quite right. Check for a typo?",
    },
  },
};
