import type { CardRecord } from "@/card-data/types";
import type { CardEmailSnapshot } from "@/exchange/types";

export function buildCardEmailSnapshot(card: CardRecord): CardEmailSnapshot {
  return {
    slug: card.slug,
    displayName: card.displayName,
    email: card.email,
    photoKey: card.photoKey,
    contact: card.contact,
    links: card.bookingLinks,
    pageCopy: {
      emailFromName: card.pageCopy.emailFromName,
    },
    copy: {
      followUpEmail: card.copy.followUpEmail,
    },
  };
}
