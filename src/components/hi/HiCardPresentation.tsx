"use client";

import { HiCardAbout } from "@/components/hi/HiCardAbout";
import { HiSocialLinkIcon } from "@/components/hi/HiSocialLinkIcon";
import { HiThemeSwitch } from "@/components/hi/HiThemeSwitch";
import { HiWeMetBannerBand, HiWeMetBannerTop } from "@/components/hi/HiWeMetBanner";
import { HiWhatIDoChips } from "@/components/hi/HiWhatIDoChips";
import { DidiBuildLeafIcon, WeMetMarkIcon } from "@/components/hi/icons/HiCardIcons";
import { Button } from "@/components/ui/Button";
import type { CardPlan, CardRecord } from "@/card-data/types";
import {
  cardContentFlags,
  cardGreeting,
  cardInitials,
  cardLinkEntries,
  servicesForChips,
  WE_MET_CARD_HOME_URL,
} from "@/lib/hi-card/card-content";
import { HiVisitorReceipt } from "@/components/hi/HiVisitorReceipt";
import { HI_CONTACT_SENT_BUTTON_LABEL } from "@/lib/hi-card/contact-sent-label";
import type { HiOwnerContact, HiPageCard } from "@/lib/hi-card/hi-page-card";
import { ownerFirstName } from "@/lib/hi-card/hi-page-card";
import { receiptReloadFollowUpLine } from "@/lib/hi-card/visitor-receipt-copy";
import Image from "next/image";
import type { MouseEvent, Ref } from "react";
import { useEffect, useState } from "react";

export type HiCardCtaMode =
  | { kind: "exchange" }
  | {
      kind: "receipt";
      slug: string;
      visitorFirst: string;
      ownerContact: HiOwnerContact | null;
      leadToken: string;
      detailsSent: boolean;
      vcardSaveResetSignal: number;
      onTellMore: () => void;
      onVcardFailure: () => void;
    }
  | { kind: "reload-fallback" };

export type HiCardPresentationProps = {
  card: CardRecord | HiPageCard;
  photoUrl: string | null;
  plan?: CardPlan;
  /** No exchange flow (button inert; sheet/sticky live outside this component). */
  preview?: boolean;
  /** Chips and About “Show more”; when false, links render as non-navigating spans. */
  interactive?: boolean;
  /** Editor preview placeholder; not persisted on the card record. */
  greetingOverride?: string;
  /** Fixed-height slot (landing phone); uses design 390px top card margin. */
  embedded?: boolean;
  exchangeButtonRef?: Ref<HTMLButtonElement>;
  ctaRef?: Ref<HTMLDivElement>;
  onOpenExchange?: (event: MouseEvent<HTMLButtonElement>) => void;
  thanksLine?: string | null;
  /** After details were sent on this device; exchange sheet cannot open. */
  detailsSent?: boolean;
  ctaMode?: HiCardCtaMode;
};

function ExchangeRing({ small }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 rounded-pill"
      style={{
        animation: `${small ? "hi-ring-pulse-sm" : "hi-ring-pulse"} 2.6s 0.4s linear infinite`,
      }}
    />
  );
}

export function HiCardPresentation({
  card,
  photoUrl,
  plan = "free",
  preview = false,
  interactive = true,
  embedded = false,
  exchangeButtonRef,
  ctaRef,
  onOpenExchange,
  thanksLine,
  greetingOverride,
  detailsSent = false,
  ctaMode = { kind: "exchange" },
}: HiCardPresentationProps) {
  const { copy, pageCopy } = card;
  const flags = cardContentFlags(card);
  const initials = cardInitials(card.name);
  const greeting = greetingOverride ?? cardGreeting(card.name);
  const [photoBroken, setPhotoBroken] = useState(false);
  const showPhoto = flags.hasPhoto && Boolean(photoUrl) && !photoBroken;

  useEffect(() => {
    setPhotoBroken(false);
  }, [photoUrl]);

  const chips = servicesForChips(card.services?.items).map((s) => ({
    label: s.title,
    explanation: s.description,
  }));
  const linkEntries = cardLinkEntries(card.links);
  const showBanner = plan === "free";
  const ownerFirst = ownerFirstName(card.name);
  const showReceipt = !preview && ctaMode.kind === "receipt";
  const showReloadFallback = !preview && ctaMode.kind === "reload-fallback";
  const exchangeDisabled = detailsSent && ctaMode.kind === "exchange";

  const cardTopMargin =
    embedded || showBanner ? "mt-[84px]" : "mt-[clamp(16px,5svh,48px)]";
  const rootClass = embedded
    ? "hi-card-page relative isolate h-[845px] overflow-hidden bg-bg text-ink [container-type:inline-size]"
    : "hi-card-page relative isolate min-h-svh overflow-hidden bg-bg text-ink [container-type:inline-size]";

  const mainClass = embedded
    ? "mx-auto flex h-full max-w-[420px] flex-col items-center gap-12 overflow-hidden px-6 pb-5 pt-4 text-center"
    : "mx-auto flex min-h-svh max-w-[420px] flex-col items-center gap-12 px-6 pb-5 pt-4 text-center";

  return (
    <div className={rootClass}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[200px] left-1/2 z-[-1] h-[420px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-soft),transparent)]"
      />

      <HiWeMetBannerTop show={showBanner} />

      <main className={mainClass}>
        <div className="flex w-full flex-col items-center gap-6">
          <section
            aria-label={card.name}
            className={`relative w-full rounded-[24px] border border-line bg-surface px-6 py-7 text-left ${cardTopMargin}`}
          >
            <div className="-mt-24 flex flex-col gap-6">
              <section
                aria-label={card.name}
                className="flex flex-col items-center gap-3.5 text-center"
              >
                {showPhoto && photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt={pageCopy.headshotAlt}
                    width={136}
                    height={136}
                    className="block h-[136px] w-[136px] shrink-0 rounded-full object-cover bg-surface-2 shadow-[0_0_0_6px_var(--bg)]"
                    priority={embedded}
                    unoptimized
                    onError={() => setPhotoBroken(true)}
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex h-[136px] w-[136px] shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-[44px] font-semibold tracking-[-0.02em] text-ink shadow-[0_0_0_6px_var(--bg)]"
                  >
                    {initials}
                  </div>
                )}
                <div className="flex min-w-0 flex-col items-center gap-1">
                  <p className="m-0 text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink">
                    {greeting}
                  </p>
                  {flags.hasRole && (
                    <p className="m-0 text-[15px] font-medium leading-[1.45] text-ink-muted text-balance">
                      {card.role}
                    </p>
                  )}
                </div>
              </section>

              <section
                ref={preview ? undefined : ctaRef}
                aria-label={copy.exchangeAriaLabel}
                className="-mt-1 flex flex-col gap-1"
              >
                {showReceipt && ctaMode.kind === "receipt" ? (
                  <HiVisitorReceipt
                    slug={ctaMode.slug}
                    ownerFirst={ownerFirst}
                    visitorFirst={ctaMode.visitorFirst}
                    ownerContact={ctaMode.ownerContact}
                    leadToken={ctaMode.leadToken}
                    detailsSent={ctaMode.detailsSent}
                    vcardSaveResetSignal={ctaMode.vcardSaveResetSignal}
                    onTellMore={ctaMode.onTellMore}
                    onVcardFailure={ctaMode.onVcardFailure}
                  />
                ) : showReloadFallback ? (
                  <>
                    <Button
                      type="button"
                      disabled
                      aria-disabled
                      className="min-h-14 w-full text-[17px] font-semibold"
                    >
                      {HI_CONTACT_SENT_BUTTON_LABEL}
                    </Button>
                    <p className="m-0 mt-1 text-center text-[14px] font-medium leading-normal text-ink-muted">
                      {receiptReloadFollowUpLine(ownerFirst)}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="relative isolate flex">
                      {!exchangeDisabled && <ExchangeRing />}
                      {preview ? (
                        <Button
                          type="button"
                          tabIndex={-1}
                          className="min-h-14 w-full text-[17px] font-semibold"
                        >
                          Exchange contact
                        </Button>
                      ) : (
                        <Button
                          ref={exchangeButtonRef}
                          type="button"
                          onClick={onOpenExchange}
                          disabled={exchangeDisabled}
                          aria-disabled={exchangeDisabled}
                          className="min-h-14 w-full text-[17px] font-semibold"
                        >
                          {exchangeDisabled
                            ? HI_CONTACT_SENT_BUTTON_LABEL
                            : "Exchange contact"}
                        </Button>
                      )}
                    </div>
                    {flags.hasAlternate &&
                      card.alternate &&
                      (!interactive ? (
                        <span className="hi-link-alternate inline-flex min-h-11 items-center self-center px-2 text-[15px] font-medium">
                          {card.alternate.label}
                        </span>
                      ) : (
                        <a
                          href={card.alternate.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hi-link-alternate inline-flex min-h-11 items-center self-center px-2 text-[15px] font-medium"
                        >
                          {card.alternate.label}
                        </a>
                      ))}
                    {thanksLine && (
                      <p
                        role="status"
                        className="m-0 mt-1 animate-hi-fade text-center text-[15px] font-medium leading-normal text-ink"
                      >
                        {thanksLine}
                      </p>
                    )}
                  </>
                )}
              </section>

              <div aria-hidden className="h-px bg-line" />
            </div>

            {flags.hasAbout && card.about && (
              <div className="mt-6">
                <HiCardAbout
                  title={card.about.title}
                  paragraphs={card.about.paragraphs}
                  interactive={interactive}
                />
              </div>
            )}

            {flags.hasServices && card.services && (
              <div
                className={`flex flex-col gap-3.5 ${flags.hasAbout ? "mt-6 border-t border-line pt-6" : "mt-6"}`}
              >
                <h3 className="m-0 text-[22px] font-semibold leading-[1.15] tracking-[-0.02em]">
                  {card.services.title}
                </h3>
                <HiWhatIDoChips chips={chips} interactive={interactive} />
              </div>
            )}

            {flags.hasLinks && (
              <div
                className={`mt-6 flex flex-col gap-3 ${flags.hasServices || flags.hasAbout ? "pt-4" : ""}`}
              >
                <ul className="m-0 flex list-none flex-wrap justify-end gap-2 p-0">
                  {linkEntries.map((link) => (
                    <li key={`${link.type}-${link.url}`}>
                      {!interactive ? (
                        <span
                          aria-label={link.label}
                          title={link.label}
                          className="hi-link-social flex h-11 w-11 items-center justify-center rounded-pill border border-line"
                        >
                          <HiSocialLinkIcon type={link.type} />
                        </span>
                      ) : (
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={link.label}
                          title={link.label}
                          className="hi-link-social flex h-11 w-11 items-center justify-center rounded-pill border border-line transition-[background-color,color] duration-120"
                        >
                          <HiSocialLinkIcon type={link.type} />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <nav aria-label={copy.footerNavLabel} className="mt-auto">
          <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-0.5 p-0">
            <li className="pl-2 text-[15px] font-medium text-ink-muted">Powered by</li>
            <li>
              {!interactive ? (
                <span className="hi-link-attribution inline-flex min-h-11 items-center gap-2 rounded-pill px-2 text-[15px] font-medium">
                  <WeMetMarkIcon size={14} />
                  We Met
                </span>
              ) : (
                <a
                  href={WE_MET_CARD_HOME_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hi-link-attribution inline-flex min-h-11 items-center gap-2 rounded-pill px-2 text-[15px] font-medium"
                >
                  <WeMetMarkIcon size={14} />
                  We Met
                </a>
              )}
            </li>
            <li aria-hidden className="h-[3px] w-[3px] rounded-full bg-line-strong" />
            <li>
              {!interactive ? (
                <span className="hi-link-attribution inline-flex min-h-11 items-center gap-2 rounded-pill px-2 text-[15px] font-medium">
                  <DidiBuildLeafIcon size={12} className="text-accent" />
                  Didi Build
                </span>
              ) : (
                <a
                  href="https://didi.build"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hi-link-attribution inline-flex min-h-11 items-center gap-2 rounded-pill px-2 text-[15px] font-medium"
                >
                  <DidiBuildLeafIcon size={12} className="text-accent" />
                  Didi Build
                </a>
              )}
            </li>
            {!preview && (
              <li>
                <HiThemeSwitch />
              </li>
            )}
          </ul>
        </nav>
      </main>

      <HiWeMetBannerBand show={showBanner} />
    </div>
  );
}
