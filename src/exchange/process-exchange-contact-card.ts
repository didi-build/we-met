import { isVisitorVisibleCard } from "@/card-data/live-card";
import type { CardRepository } from "@/card-data/repository";
import { verifyExchangeContactCardToken } from "@/exchange/exchange-contact-card-token";
import type { ExchangeRateLimiter } from "@/exchange/rate-limit";
import {
  buildOwnerVCardAttachment,
  type ReadOnlyR2Assets,
} from "@/lib/hi/build-owner-vcard";

export type ProcessExchangeContactCardDeps = {
  tokenSecret: string;
  rateLimiter: ExchangeRateLimiter;
  clientIp: string;
  assets: ReadOnlyR2Assets;
  logDownload: (leadId: string) => void;
};

export type ProcessExchangeContactCardContext = {
  routeLeadId: string;
  token: string;
};

export type ProcessExchangeContactCardResult =
  { status: "success"; vcardBody: string; filename: string } | { status: "not_found" };

export function exchangeContactCardRateLimitKey(clientIp: string): string {
  return `exchange_contact_card:${clientIp}`;
}

function vcardPhotoLogger() {
  return {
    logMissingPhoto(key: string) {
      console.error("exchange_contact_card_photo_missing", { photoKey: key });
    },
    logNonJpegPhoto(key: string) {
      console.error("exchange_contact_card_photo_not_jpeg", { photoKey: key });
    },
  };
}

export async function processExchangeContactCardDownload(
  ctx: ProcessExchangeContactCardContext,
  repo: CardRepository,
  deps: ProcessExchangeContactCardDeps,
): Promise<ProcessExchangeContactCardResult> {
  const rate = await deps.rateLimiter.check(
    exchangeContactCardRateLimitKey(deps.clientIp),
  );
  if (!rate.allowed) {
    return { status: "not_found" };
  }

  const verified = verifyExchangeContactCardToken(deps.tokenSecret, ctx.token);
  if (!verified.ok) {
    return { status: "not_found" };
  }

  if (verified.payload.leadId !== ctx.routeLeadId) {
    return { status: "not_found" };
  }

  const card = await repo.getById(verified.payload.cardId);
  if (!card || !(await isVisitorVisibleCard(repo, card))) {
    return { status: "not_found" };
  }

  try {
    const { vcardBody, filename } = await buildOwnerVCardAttachment(
      card.contact,
      card.email,
      card.photoKey,
      deps.assets,
      vcardPhotoLogger(),
    );
    deps.logDownload(verified.payload.leadId);
    return { status: "success", vcardBody, filename };
  } catch {
    return { status: "not_found" };
  }
}
