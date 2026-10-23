import { lookupCard } from "@/card-data/lookup";
import type { CardRepository } from "@/card-data/repository";
import type { WeMetHostConfig } from "@/config/we-met";
import {
  buildOwnerVCardAttachment,
  type ReadOnlyR2Assets,
} from "@/lib/hi/build-owner-vcard";
import type { ExchangeRateLimiter } from "@/exchange/rate-limit";
import { verifyDetailsToken } from "@/exchange/token";
import type { ValidatedVCardTokenInput } from "@/exchange/parse-vcard-body";

export type ProcessVCardDeps = {
  tokenSecret: string;
  rateLimiter: ExchangeRateLimiter;
  clientIp: string;
  assets: ReadOnlyR2Assets;
  now: () => Date;
};

export type ProcessVCardContext = {
  hostname: string;
  hostConfig: WeMetHostConfig;
};

export type ProcessVCardResult =
  | { status: "success"; vcardBody: string; filename: string }
  | { status: "invalid_token" }
  | { status: "card_not_found" }
  | { status: "rate_limited" }
  | { status: "server_error" };

function vcardPhotoLogger() {
  return {
    logMissingPhoto(key: string) {
      console.error("vcard_photo_missing", { photoKey: key });
    },
    logNonJpegPhoto(key: string) {
      console.error("vcard_photo_not_jpeg", { photoKey: key });
    },
  };
}

export async function processVCardDownload(
  input: ValidatedVCardTokenInput,
  ctx: ProcessVCardContext,
  repo: CardRepository,
  deps: ProcessVCardDeps,
): Promise<ProcessVCardResult> {
  const rate = await deps.rateLimiter.check(deps.clientIp);
  if (!rate.allowed) {
    return { status: "rate_limited" };
  }

  const verified = verifyDetailsToken(
    deps.tokenSecret,
    input.token,
    Math.floor(deps.now().getTime() / 1000),
  );
  if (!verified.ok) {
    return { status: "invalid_token" };
  }

  const card = await lookupCard(
    { hostname: ctx.hostname, pathname: `/hi/${verified.payload.cardSlug}` },
    repo,
    ctx.hostConfig,
  );

  if (!card) {
    return { status: "card_not_found" };
  }

  if (card.id !== verified.payload.cardId || card.slug !== verified.payload.cardSlug) {
    return { status: "invalid_token" };
  }

  try {
    const { vcardBody, filename } = await buildOwnerVCardAttachment(
      card.contact,
      card.email,
      card.photoKey,
      deps.assets,
      vcardPhotoLogger(),
    );
    return { status: "success", vcardBody, filename };
  } catch {
    return { status: "server_error" };
  }
}
