import type { CardRecord } from "@/card-data/types";

/** Static landing hero preview — not loaded from D1, R2, or design/ at runtime. */
export const LANDING_CARD_PREVIEW_PHOTO_URL = "/landing-preview/didi.png";

export const LANDING_CARD_PREVIEW_FIXTURE: CardRecord = {
  id: "landing-preview",
  accountId: "landing-preview-account",
  status: "live",
  slug: "landing-preview",
  variant: "mono",
  displayName: "Didi Shoukralla",
  email: "didi@didi.build",
  photoKey: "landing-preview",
  name: "Didi Shoukralla",
  role: "Software Engineer and Technical Advisor",
  about: {
    title: "About me",
    paragraphs: [
      "I'm a software engineer in Toronto. I help founders who built their app with AI get it ready for real users, paying customers, or investors.",
      "I've shipped software at startups and on production teams, so I know what breaks once people actually show up.",
      "If you're building something, I'm happy to give you an honest, straight read during your free consultation.",
    ],
  },
  services: {
    title: "What I do",
    items: [
      {
        title: "System audit",
        description:
          "I review your app and give you a written summary: what's solid, what's risky, and what to do next.",
      },
      {
        title: "Custom development",
        description:
          "I build what your product needs, whether that's a new feature or a custom tool made just for you.",
      },
      {
        title: "Technical advisory",
        description:
          "I answer your technical questions in plain English and help you decide what to build, what to skip, and what to ask your developers.",
      },
      {
        title: "Fractional CTO",
        description:
          "I act as your part-time technical lead: I guide the technical decisions and the team, without a full-time hire.",
      },
      {
        title: "AI Integrations",
        description:
          "I add AI to your product where it helps, like a chat assistant, smarter search, or an agent that handles tasks for you.",
      },
    ],
  },
  links: {
    website: "https://didi.build",
    linkedin: "https://www.linkedin.com/in/diadem-shoukralla/",
    github: "https://github.com/DiademShoukralla/",
    instagram: "https://instagram.com/didi.build",
  },
  alternate: {
    url: "https://didi.build/book",
    label: "or book a time directly",
  },
  bookingLinks: { bookingUrl: "https://didi.build/book" },
  pageCopy: {
    pageTitle: "Didi Shoukralla · We Met",
    emailFromName: "Didi Shoukralla",
    headshotAlt: "Didi Shoukralla",
  },
  contact: {
    name: {
      full: "Didi Shoukralla",
      family: "Shoukralla",
      given: "Didi",
      nickname: "Didi",
    },
    org: "Didi Build",
    title: "Software Engineer and Technical Advisor",
    phone: "+1-416-555-0100",
    vcardNote: "Met via We Met",
    urls: [{ url: "https://didi.build", type: "Portfolio" }],
  },
  copy: {
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
  },
  updatedAt: "2026-01-01T00:00:00.000Z",
};
