"use client";

import { HiCardAbout } from "@/components/hi/HiCardAbout";
import { HiExchangeSheet } from "@/components/hi/HiExchangeSheet";
import { HiSocialLinkIcon } from "@/components/hi/HiSocialLinkIcon";
import { HiStickyExchangeBar } from "@/components/hi/HiStickyExchangeBar";
import { HiThemeSwitch } from "@/components/hi/HiThemeSwitch";
import { HiWeMetBannerBand, HiWeMetBannerTop } from "@/components/hi/HiWeMetBanner";
import { HiWhatIDoChips } from "@/components/hi/HiWhatIDoChips";
import { Button } from "@/components/ui/Button";
import type { CardRecord } from "@/card-data/types";
import {
  cardContentFlags,
  cardGreeting,
  cardInitials,
  servicesForChips,
  socialLinks,
  WE_MET_CARD_HOME_URL,
} from "@/lib/hi-card/card-content";
import { substituteFirstName } from "@/lib/copy/substitute-first-name";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type HiPageClientProps = {
  card: CardRecord;
  photoUrl: string | null;
};

function ExchangeRing() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 rounded-pill shadow-[0_0_0_0_color-mix(in_oklch,var(--accent)_40%,transparent)]"
      style={{ animation: "hi-ring-pulse 2.6s 0.4s ease-in-out infinite" }}
    />
  );
}

function LeafMark() {
  return (
    <svg aria-hidden width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path
        d="M8 1.5c-3 2.5-4.5 5.5-4.5 8.5 0 2.2 1.8 4 4 4s4-1.8 4-4c0-3-1.5-6-3.5-8.5z"
        opacity="0.9"
      />
    </svg>
  );
}

export function HiPageClient({ card, photoUrl }: HiPageClientProps) {
  const { copy, pageCopy } = card;
  const flags = cardContentFlags(card);
  const initials = cardInitials(card.name);
  const greeting = cardGreeting(card.name);
  const chips = servicesForChips(card.services).map((s) => ({
    label: s.label,
    explanation: s.description,
  }));
  const social = socialLinks(card.publicLinks);
  const showBanner = card.plan === "free";

  const exchangeButtonRef = useRef<HTMLButtonElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [leadToken, setLeadToken] = useState("");
  const [stickyVisible, setStickyVisible] = useState(false);

  const openSheet = useCallback(() => {
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    exchangeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const el = ctaRef.current;
      if (!el) {
        return;
      }
      const past = el.getBoundingClientRect().top < 0;
      setStickyVisible(past);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const thanksLine =
    connected && !sheetOpen
      ? substituteFirstName(copy.thanksMessage, firstName || "there")
      : null;

  const cardMarginTop = showBanner ? "mt-0" : "mt-[clamp(16px,5svh,48px)]";

  return (
    <div className="relative isolate min-h-svh overflow-hidden bg-bg text-ink [container-type:inline-size]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[200px] left-1/2 z-[-1] h-[420px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-soft),transparent)]"
      />

      <HiWeMetBannerTop show={showBanner} />

      <HiStickyExchangeBar
        visible={stickyVisible}
        name={card.name}
        role={card.role}
        initials={initials}
        photoUrl={photoUrl}
        photoAlt={pageCopy.headshotAlt}
        onExchange={openSheet}
      />

      <main className="mx-auto flex min-h-svh max-w-[420px] flex-col items-center gap-12 px-6 pb-5 pt-4 text-center">
        <div className="flex w-full flex-col items-center gap-6">
          <section
            aria-label={card.name}
            className={`relative w-full rounded-[24px] border border-line bg-surface px-6 py-7 text-left ${cardMarginTop}`}
          >
            <div className="-mt-24 flex flex-col gap-6">
              <section
                aria-label={card.name}
                className="flex flex-col items-center gap-3.5 text-center"
              >
                {flags.hasPhoto && photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt={pageCopy.headshotAlt}
                    width={136}
                    height={136}
                    className="block h-[136px] w-[136px] shrink-0 rounded-full object-cover bg-surface-2 shadow-[0_0_0_6px_var(--bg)]"
                    priority
                    unoptimized
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex h-[136px] w-[136px] shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-[44px] font-semibold tracking-tight text-ink shadow-[0_0_0_6px_var(--bg)]"
                  >
                    {initials}
                  </div>
                )}
                <div className="flex min-w-0 flex-col items-center gap-1">
                  <p className="m-0 text-[1.75rem] font-semibold leading-tight tracking-tight text-accent-text">
                    {greeting}
                  </p>
                  {flags.hasRole && (
                    <p className="m-0 text-[15px] font-medium leading-snug text-ink-muted text-balance">
                      {card.role}
                    </p>
                  )}
                </div>
              </section>

              <section
                ref={ctaRef}
                aria-label={copy.exchangeAriaLabel}
                className="-mt-1 flex flex-col gap-1"
              >
                <div className="relative isolate">
                  <ExchangeRing />
                  <Button
                    ref={exchangeButtonRef}
                    type="button"
                    onClick={openSheet}
                    className="min-h-14 w-full text-[15px]"
                  >
                    Exchange contact
                  </Button>
                </div>
                {flags.hasFallback && (
                  <a
                    href={card.fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center self-center px-2 text-[15px] font-medium text-ink-muted underline decoration-1 underline-offset-[3px] hover:text-ink"
                  >
                    {card.fallbackLabel}
                  </a>
                )}
                {thanksLine && (
                  <p
                    role="status"
                    className="m-0 mt-1 animate-hi-fade text-center text-[15px] font-medium text-accent-text"
                  >
                    {thanksLine}
                  </p>
                )}
              </section>

              <div aria-hidden className="h-px bg-line" />
            </div>

            {flags.hasAbout && card.aboutTitle && card.about && (
              <HiCardAbout title={card.aboutTitle} paragraphs={card.about} />
            )}

            {flags.hasServices && card.servicesTitle && (
              <div
                className={`flex flex-col gap-3.5 ${flags.hasAbout ? "mt-6 border-t border-line pt-6" : "mt-6"}`}
              >
                <h3 className="m-0 text-[1.375rem] font-semibold leading-tight tracking-tight">
                  {card.servicesTitle}
                </h3>
                <HiWhatIDoChips chips={chips} />
              </div>
            )}

            {flags.hasSocialLinks && (
              <div
                className={`mt-6 flex flex-col gap-3 ${flags.hasServices || flags.hasAbout ? "" : ""}`}
              >
                <ul className="m-0 flex list-none flex-wrap justify-end gap-2 p-0">
                  {social.map((link) => (
                    <li key={`${link.type}-${link.url}`}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={link.label}
                        title={link.label}
                        className="flex h-11 w-11 items-center justify-center rounded-pill border border-line text-ink no-underline transition-colors hover:bg-ink hover:text-bg"
                      >
                        <HiSocialLinkIcon type={link.type} large />
                      </a>
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
              <a
                href={WE_MET_CARD_HOME_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-pill px-2 text-[15px] font-medium text-ink-muted no-underline hover:bg-surface-2 hover:text-ink"
              >
                We Met
              </a>
            </li>
            <li aria-hidden className="h-[3px] w-[3px] rounded-full bg-line-strong" />
            <li>
              <a
                href="https://didi.build"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-pill px-2 text-[15px] font-medium text-ink-muted no-underline hover:bg-surface-2 hover:text-ink"
              >
                <LeafMark />
                Didi Build
              </a>
            </li>
            <li>
              <HiThemeSwitch />
            </li>
          </ul>
        </nav>
      </main>

      <HiWeMetBannerBand show={showBanner} />

      <HiExchangeSheet
        slug={card.slug}
        copy={copy.exchangeSheet}
        open={sheetOpen}
        initialStep={connected ? "details" : "exchange"}
        firstName={firstName}
        leadToken={leadToken}
        onClose={closeSheet}
        onExchangeSuccess={(nextFirstName, token) => {
          setConnected(true);
          setFirstName(nextFirstName);
          setLeadToken(token);
        }}
      />
    </div>
  );
}
