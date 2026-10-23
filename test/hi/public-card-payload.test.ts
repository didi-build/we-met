import { describe, expect, it } from "vitest";
import { exampleCardRecord } from "../helpers/example-card";
import type { CardRecord } from "@/card-data/types";
import {
  assertNoSentinelsInPublicHiCardJson,
  assertPublicHiCardPayloadShape,
  PUBLIC_HI_CARD_PAYLOAD_KEYS,
  serializePublicHiCard,
} from "@/lib/hi-card/public-card-payload";

/** Unique strings for fields that must not reach the public /hi browser payload. */
export const PUBLIC_HI_CARD_LEAK_SENTINELS = {
  id: "__DIDI758_SENTINEL_CARD_ID__",
  accountId: "__DIDI758_SENTINEL_ACCOUNT_ID__",
  email: "__DIDI758_SENTINEL_OWNER_EMAIL__",
  displayName: "__DIDI758_SENTINEL_DISPLAY_NAME__",
  photoKey: "__DIDI758_SENTINEL_PHOTO_KEY__",
  updatedAt: "__DIDI758_SENTINEL_UPDATED_AT__",
  bookingUrl: "__DIDI758_SENTINEL_BOOKING_URL__",
  pageTitle: "__DIDI758_SENTINEL_PAGE_TITLE__",
  emailFromName: "__DIDI758_SENTINEL_EMAIL_FROM_NAME__",
  contactGiven: "__DIDI758_SENTINEL_CONTACT_GIVEN__",
  contactFamily: "__DIDI758_SENTINEL_CONTACT_FAMILY__",
  contactNickname: "__DIDI758_SENTINEL_CONTACT_NICKNAME__",
  contactFull: "__DIDI758_SENTINEL_CONTACT_FULL__",
  contactOrg: "__DIDI758_SENTINEL_CONTACT_ORG__",
  contactTitle: "__DIDI758_SENTINEL_CONTACT_TITLE__",
  contactPhone: "__DIDI758_SENTINEL_CONTACT_PHONE__",
  contactVcardNote: "__DIDI758_SENTINEL_VCARD_NOTE__",
  contactUrl: "__DIDI758_SENTINEL_CONTACT_URL__",
  aboutDraftNotes: "__DIDI758_SENTINEL_ABOUT_DRAFT_NOTES__",
  copyLegacyOwnerNote: "__DIDI758_SENTINEL_COPY_LEGACY_OWNER_NOTE__",
  linksWhatsapp: "__DIDI758_SENTINEL_LINKS_WHATSAPP__",
} as const;

function leakFixtureCard(): CardRecord {
  const base = exampleCardRecord();
  const poisonedAbout = {
    title: base.about!.title,
    paragraphs: base.about!.paragraphs,
    draftNotes: PUBLIC_HI_CARD_LEAK_SENTINELS.aboutDraftNotes,
  };
  const poisonedLinks = {
    ...base.links,
    whatsapp: PUBLIC_HI_CARD_LEAK_SENTINELS.linksWhatsapp,
  };
  const poisonedCopy = {
    ...base.copy,
    legacyOwnerNote: PUBLIC_HI_CARD_LEAK_SENTINELS.copyLegacyOwnerNote,
  };

  return {
    ...base,
    id: PUBLIC_HI_CARD_LEAK_SENTINELS.id,
    accountId: PUBLIC_HI_CARD_LEAK_SENTINELS.accountId,
    email: PUBLIC_HI_CARD_LEAK_SENTINELS.email,
    displayName: PUBLIC_HI_CARD_LEAK_SENTINELS.displayName,
    photoKey: PUBLIC_HI_CARD_LEAK_SENTINELS.photoKey,
    updatedAt: PUBLIC_HI_CARD_LEAK_SENTINELS.updatedAt,
    bookingLinks: { bookingUrl: PUBLIC_HI_CARD_LEAK_SENTINELS.bookingUrl },
    pageCopy: {
      ...base.pageCopy,
      pageTitle: PUBLIC_HI_CARD_LEAK_SENTINELS.pageTitle,
      emailFromName: PUBLIC_HI_CARD_LEAK_SENTINELS.emailFromName,
    },
    contact: {
      name: {
        full: PUBLIC_HI_CARD_LEAK_SENTINELS.contactFull,
        given: PUBLIC_HI_CARD_LEAK_SENTINELS.contactGiven,
        family: PUBLIC_HI_CARD_LEAK_SENTINELS.contactFamily,
        nickname: PUBLIC_HI_CARD_LEAK_SENTINELS.contactNickname,
      },
      org: PUBLIC_HI_CARD_LEAK_SENTINELS.contactOrg,
      title: PUBLIC_HI_CARD_LEAK_SENTINELS.contactTitle,
      phone: PUBLIC_HI_CARD_LEAK_SENTINELS.contactPhone,
      vcardNote: PUBLIC_HI_CARD_LEAK_SENTINELS.contactVcardNote,
      urls: [{ url: PUBLIC_HI_CARD_LEAK_SENTINELS.contactUrl, type: "Portfolio" }],
    },
    about: poisonedAbout as CardRecord["about"],
    links: poisonedLinks as CardRecord["links"],
    copy: poisonedCopy as CardRecord["copy"],
  };
}

describe("serializePublicHiCard", () => {
  it("includes only rendered /hi fields with exact nested keys", () => {
    const payload = serializePublicHiCard(leakFixtureCard());

    expect(Object.keys(payload).sort()).toEqual(
      [...PUBLIC_HI_CARD_PAYLOAD_KEYS].sort(),
    );
    assertPublicHiCardPayloadShape(payload);
    assertNoSentinelsInPublicHiCardJson(
      payload,
      Object.values(PUBLIC_HI_CARD_LEAK_SENTINELS),
    );
    expect(payload.about).not.toHaveProperty("draftNotes");
    expect(payload.copy).not.toHaveProperty("legacyOwnerNote");
    expect(payload.links).not.toHaveProperty("whatsapp");
  });

  it("strips non-rendered field values even when nested under new property names", () => {
    const card = leakFixtureCard();
    const payload = serializePublicHiCard({
      ...card,
      ownerPhone: card.contact.phone,
      cardRef: card.accountId,
      note: card.contact.vcardNote,
    } as CardRecord & { ownerPhone: string; cardRef: string; note: string });

    assertNoSentinelsInPublicHiCardJson(
      payload,
      Object.values(PUBLIC_HI_CARD_LEAK_SENTINELS),
    );
  });

  it("fails sentinel check when a non-rendered value is injected into the payload", () => {
    const payload = serializePublicHiCard(exampleCardRecord());
    const poisoned = {
      ...payload,
      sneaky: PUBLIC_HI_CARD_LEAK_SENTINELS.accountId,
    } as typeof payload & { sneaky: string };

    expect(() =>
      assertNoSentinelsInPublicHiCardJson(poisoned, [
        PUBLIC_HI_CARD_LEAK_SENTINELS.accountId,
      ]),
    ).toThrow(/sentinel/);
  });
});
