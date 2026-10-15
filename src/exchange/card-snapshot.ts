import type { CardRecord } from "@/card-data/types";
import { absoluteUrl } from "@/config/we-met";
import type { CardEmailSnapshot } from "@/exchange/types";

/** Visitor follow-up email booking link: alternate URL, else the public card page. */
export function resolveCardBookingUrl(card: CardRecord, baseUrl: string): string {
  const stored = card.bookingLinks.bookingUrl?.trim();
  if (stored) {
    return stored;
  }
  const alternate = card.alternate?.url?.trim();
  if (alternate) {
    return alternate;
  }
  return absoluteUrl(baseUrl, `/hi/${card.slug}`);
}

export function buildCardEmailSnapshot(
  card: CardRecord,
  baseUrl: string,
): CardEmailSnapshot {
  return {
    slug: card.slug,
    displayName: card.displayName,
    email: card.email,
    photoKey: card.photoKey,
    contact: card.contact,
    links: { bookingUrl: resolveCardBookingUrl(card, baseUrl) },
    pageCopy: {
      emailFromName: card.pageCopy.emailFromName,
    },
    copy: {
      followUpEmail: card.copy.followUpEmail,
    },
  };
}
