import type {
  CardAbout,
  CardAlternate,
  CardCopy,
  CardPageCopy,
  CardPublicLinksMap,
  CardRecord,
  CardServices,
} from "@/card-data/types";

/** Fields the public /hi UI reads before an exchange (server → browser). */
export type PublicHiCardPageCopy = Pick<CardPageCopy, "headshotAlt">;

export type PublicHiCardPayload = {
  slug: string;
  name: string;
  role?: string;
  about?: CardAbout;
  services?: CardServices;
  links?: CardPublicLinksMap;
  alternate?: CardAlternate;
  pageCopy: PublicHiCardPageCopy;
  copy: CardCopy;
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

const FORBIDDEN_TOP_LEVEL_KEYS = [
  "accountId",
  "id",
  "email",
  "status",
  "displayName",
  "variant",
  "bookingLinks",
  "contact",
  "updatedAt",
  "photoKey",
] as const;

export function serializePublicHiCard(card: CardRecord): PublicHiCardPayload {
  return {
    slug: card.slug,
    name: card.name,
    role: card.role,
    about: card.about,
    services: card.services,
    links: card.links,
    alternate: card.alternate,
    pageCopy: { headshotAlt: card.pageCopy.headshotAlt },
    copy: card.copy,
    hasPhoto: Boolean(card.photoKey),
  };
}

const FORBIDDEN_NESTED_KEYS = new Set([
  "contact",
  "accountId",
  "photoKey",
  "bookingLinks",
  "displayName",
  "vcardNote",
  "family",
  "given",
  "nickname",
  "urls",
]);

function assertNoForbiddenNestedKeys(value: unknown, path = "payload"): void {
  if (value === null || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      assertNoForbiddenNestedKeys(item, `${path}[${index}]`);
    }
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_NESTED_KEYS.has(key)) {
      throw new Error(`public hi card payload must not include ${path}.${key}`);
    }
    if (key === "phone" || key === "email" || key === "org") {
      throw new Error(`public hi card payload must not include ${path}.${key}`);
    }
    assertNoForbiddenNestedKeys(nested, `${path}.${key}`);
  }
}

/** Assert the serialized payload cannot leak owner account or non-rendered contact fields. */
export function assertNoPublicHiCardLeaks(
  payload: PublicHiCardPayload,
  ownerEmail: string,
): void {
  const record = payload as Record<string, unknown>;
  for (const key of FORBIDDEN_TOP_LEVEL_KEYS) {
    if (key in record) {
      throw new Error(`public hi card payload must not include ${key}`);
    }
  }

  const allowed = new Set<string>(PUBLIC_HI_CARD_PAYLOAD_KEYS);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new Error(`unexpected public hi card key: ${key}`);
    }
  }

  const pageCopyKeys = Object.keys(payload.pageCopy);
  if (pageCopyKeys.length !== 1 || pageCopyKeys[0] !== "headshotAlt") {
    throw new Error(
      `public hi pageCopy must only include headshotAlt, got: ${pageCopyKeys.join(", ")}`,
    );
  }

  const json = JSON.stringify(payload);
  if (ownerEmail && json.includes(ownerEmail)) {
    throw new Error("public hi card payload must not include owner email");
  }

  assertNoForbiddenNestedKeys(payload);
}
