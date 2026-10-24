import type { CardRecord } from "@/card-data/types";
import { leadFirstNameFromFullName } from "@/email/email-template-vars";
import type { CardEmailSnapshot } from "@/exchange/types";

export function buildCardEmailSnapshot(card: CardRecord): CardEmailSnapshot {
  return {
    slug: card.slug,
    displayName: card.displayName,
    email: card.email,
    photoKey: card.photoKey,
    contact: card.contact,
    pageCopy: {
      emailFromName: card.pageCopy.emailFromName,
    },
    ownerFirstName: leadFirstNameFromFullName(card.displayName),
  };
}
