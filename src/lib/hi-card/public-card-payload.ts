import type {
  CardAbout,
  CardAlternate,
  CardCopy,
  CardCopyExchangeSheet,
  CardCopyExchangeSheetErrors,
  CardPublicLinkType,
  CardPublicLinksMap,
  CardRecord,
  CardServices,
} from "@/card-data/types";

const PUBLIC_LINK_TYPES: readonly CardPublicLinkType[] = [
  "website",
  "linkedin",
  "github",
  "instagram",
];

/** Fields the public /hi UI reads before an exchange (server → browser). */
export type PublicHiCardPageCopy = {
  headshotAlt: string;
};

export type PublicHiCardAbout = {
  title: string;
  paragraphs: string[];
};

export type PublicHiCardServiceItem = {
  title: string;
  description: string;
};

export type PublicHiCardServices = {
  title: string;
  items: PublicHiCardServiceItem[];
};

export type PublicHiCardCopyErrors = {
  nameRequired: string;
  emailRequired: string;
  emailInvalid: string;
};

export type PublicHiCardExchangeSheet = {
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
  errors: PublicHiCardCopyErrors;
};

export type PublicHiCardCopy = {
  thanksMessage: string;
  exchangeAriaLabel: string;
  footerNavLabel: string;
  exchangeSheet: PublicHiCardExchangeSheet;
};

export type PublicHiCardPayload = {
  slug: string;
  name: string;
  role?: string;
  about?: PublicHiCardAbout;
  services?: PublicHiCardServices;
  links?: CardPublicLinksMap;
  alternate?: CardAlternate;
  pageCopy: PublicHiCardPageCopy;
  copy: PublicHiCardCopy;
  hasPhoto: boolean;
};

/** Top-level keys allowed on the pre-exchange /hi card props (regression guard). */
export const PUBLIC_HI_CARD_PAYLOAD_KEYS: readonly (keyof PublicHiCardPayload)[] = [
  "slug",
  "name",
  "role",
  "about",
  "services",
  "links",
  "alternate",
  "pageCopy",
  "copy",
  "hasPhoto",
];

export const PUBLIC_HI_CARD_PAGE_COPY_KEYS = ["headshotAlt"] as const;

export const PUBLIC_HI_CARD_ABOUT_KEYS = ["title", "paragraphs"] as const;

export const PUBLIC_HI_CARD_SERVICE_ITEM_KEYS = ["title", "description"] as const;

export const PUBLIC_HI_CARD_SERVICES_KEYS = ["title", "items"] as const;

export const PUBLIC_HI_CARD_LINK_KEYS = PUBLIC_LINK_TYPES;

export const PUBLIC_HI_CARD_ALTERNATE_KEYS = ["url", "label"] as const;

export const PUBLIC_HI_CARD_COPY_KEYS = [
  "thanksMessage",
  "exchangeAriaLabel",
  "footerNavLabel",
  "exchangeSheet",
] as const;

export const PUBLIC_HI_CARD_EXCHANGE_SHEET_KEYS = [
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
] as const;

export const PUBLIC_HI_CARD_COPY_ERROR_KEYS = [
  "nameRequired",
  "emailRequired",
  "emailInvalid",
] as const;

function pickPublicAbout(about?: CardAbout): PublicHiCardAbout | undefined {
  if (!about?.title?.trim()) {
    return undefined;
  }
  const paragraphs = (about.paragraphs ?? []).filter((p) => p.trim());
  if (!paragraphs.length) {
    return undefined;
  }
  return { title: about.title, paragraphs };
}

function pickPublicServices(services?: CardServices): PublicHiCardServices | undefined {
  if (!services?.title?.trim()) {
    return undefined;
  }
  const items = (services.items ?? [])
    .filter((item) => item.title?.trim())
    .map((item) => ({
      title: item.title,
      description: item.description ?? "",
    }));
  if (!items.length) {
    return undefined;
  }
  return { title: services.title, items };
}

function pickPublicLinks(map?: CardPublicLinksMap): CardPublicLinksMap | undefined {
  if (!map) {
    return undefined;
  }
  const result: CardPublicLinksMap = {};
  for (const type of PUBLIC_LINK_TYPES) {
    const url = map[type]?.trim();
    if (url) {
      result[type] = url;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function pickPublicAlternate(alternate?: CardAlternate): CardAlternate | undefined {
  if (!alternate?.url?.trim() || !alternate?.label?.trim()) {
    return undefined;
  }
  return { url: alternate.url, label: alternate.label };
}

function pickPublicCopyErrors(
  errors: CardCopyExchangeSheetErrors,
): PublicHiCardCopyErrors {
  return {
    nameRequired: errors.nameRequired,
    emailRequired: errors.emailRequired,
    emailInvalid: errors.emailInvalid,
  };
}

function pickPublicExchangeSheet(
  sheet: CardCopyExchangeSheet,
): PublicHiCardExchangeSheet {
  return {
    exchangeTitle: sheet.exchangeTitle,
    detailsTitle: sheet.detailsTitle,
    detailsIntro: sheet.detailsIntro,
    nameLabel: sheet.nameLabel,
    emailLabel: sheet.emailLabel,
    phoneLabel: sheet.phoneLabel,
    phoneOptional: sheet.phoneOptional,
    countryCodeAriaLabel: sheet.countryCodeAriaLabel,
    submitExchange: sheet.submitExchange,
    submitDetails: sheet.submitDetails,
    consent: sheet.consent,
    closeLabel: sheet.closeLabel,
    exchangeFormAriaLabel: sheet.exchangeFormAriaLabel,
    detailsFormAriaLabel: sheet.detailsFormAriaLabel,
    notePlaceholder: sheet.notePlaceholder,
    jobTitleLabel: sheet.jobTitleLabel,
    companyLabel: sheet.companyLabel,
    noteLabel: sheet.noteLabel,
    pendingExchange: sheet.pendingExchange,
    pendingDetails: sheet.pendingDetails,
    detailsSaved: sheet.detailsSaved,
    networkErrorMessage: sheet.networkErrorMessage,
    exchangeNotSavedPrefix: sheet.exchangeNotSavedPrefix,
    exchangeNotSavedEmail: sheet.exchangeNotSavedEmail,
    exchangeNotSavedSuffix: sheet.exchangeNotSavedSuffix,
    errors: pickPublicCopyErrors(sheet.errors),
  };
}

function pickPublicCopy(copy: CardCopy): PublicHiCardCopy {
  return {
    thanksMessage: copy.thanksMessage,
    exchangeAriaLabel: copy.exchangeAriaLabel,
    footerNavLabel: copy.footerNavLabel,
    exchangeSheet: pickPublicExchangeSheet(copy.exchangeSheet),
  };
}

export function serializePublicHiCard(card: CardRecord): PublicHiCardPayload {
  const role = card.role?.trim();
  const about = pickPublicAbout(card.about);
  const services = pickPublicServices(card.services);
  const links = pickPublicLinks(card.links);
  const alternate = pickPublicAlternate(card.alternate);
  return {
    slug: card.slug,
    name: card.name,
    ...(role ? { role } : {}),
    ...(about ? { about } : {}),
    ...(services ? { services } : {}),
    ...(links ? { links } : {}),
    ...(alternate ? { alternate } : {}),
    pageCopy: { headshotAlt: card.pageCopy.headshotAlt },
    copy: pickPublicCopy(card.copy),
    hasPhoto: Boolean(card.photoKey),
  };
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  mode: "exact" | "subset" = "subset",
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      throw new Error(`unexpected key ${path}.${key}`);
    }
  }
  if (mode === "exact") {
    for (const key of allowed) {
      if (!(key in value)) {
        throw new Error(`missing key ${path}.${key}`);
      }
    }
  }
}

/** Pin exact keys at every level of the public /hi payload (regression guard). */
export function assertPublicHiCardPayloadShape(payload: PublicHiCardPayload): void {
  assertExactKeys(
    payload as Record<string, unknown>,
    PUBLIC_HI_CARD_PAYLOAD_KEYS,
    "payload",
  );

  assertExactKeys(
    payload.pageCopy as Record<string, unknown>,
    PUBLIC_HI_CARD_PAGE_COPY_KEYS,
    "payload.pageCopy",
    "exact",
  );

  if (payload.about) {
    assertExactKeys(
      payload.about as Record<string, unknown>,
      PUBLIC_HI_CARD_ABOUT_KEYS,
      "payload.about",
      "exact",
    );
    if (!Array.isArray(payload.about.paragraphs)) {
      throw new Error("payload.about.paragraphs must be an array");
    }
  }

  if (payload.services) {
    assertExactKeys(
      payload.services as Record<string, unknown>,
      PUBLIC_HI_CARD_SERVICES_KEYS,
      "payload.services",
      "exact",
    );
    for (const [index, item] of payload.services.items.entries()) {
      assertExactKeys(
        item as Record<string, unknown>,
        PUBLIC_HI_CARD_SERVICE_ITEM_KEYS,
        `payload.services.items[${index}]`,
        "exact",
      );
    }
  }

  if (payload.links) {
    assertExactKeys(
      payload.links as Record<string, unknown>,
      PUBLIC_HI_CARD_LINK_KEYS,
      "payload.links",
    );
  }

  if (payload.alternate) {
    assertExactKeys(
      payload.alternate as Record<string, unknown>,
      PUBLIC_HI_CARD_ALTERNATE_KEYS,
      "payload.alternate",
      "exact",
    );
  }

  assertExactKeys(
    payload.copy as Record<string, unknown>,
    PUBLIC_HI_CARD_COPY_KEYS,
    "payload.copy",
    "exact",
  );
  assertExactKeys(
    payload.copy.exchangeSheet as Record<string, unknown>,
    PUBLIC_HI_CARD_EXCHANGE_SHEET_KEYS,
    "payload.copy.exchangeSheet",
    "exact",
  );
  assertExactKeys(
    payload.copy.exchangeSheet.errors as Record<string, unknown>,
    PUBLIC_HI_CARD_COPY_ERROR_KEYS,
    "payload.copy.exchangeSheet.errors",
    "exact",
  );
}

/** Assert none of the given sentinel strings appear in the serialized JSON. */
export function assertNoSentinelsInPublicHiCardJson(
  payload: PublicHiCardPayload,
  sentinels: readonly string[],
): void {
  const json = JSON.stringify(payload);
  for (const sentinel of sentinels) {
    if (sentinel && json.includes(sentinel)) {
      throw new Error(`public hi card JSON must not contain sentinel: ${sentinel}`);
    }
  }
}
