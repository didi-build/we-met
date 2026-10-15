"use client";

import { HiAboutSection } from "@/components/hi/HiAboutSection";
import { HiExchangeSheet } from "@/components/hi/HiExchangeSheet";
import { HiThemeSwitch } from "@/components/hi/HiThemeSwitch";
import { SocialProfileIcon } from "@/components/SocialProfileIcon";
import { Button } from "@/components/ui/Button";
import type { CardRecord } from "@/card-data/types";
import { substituteFirstName } from "@/lib/copy/substitute-first-name";
import Image from "next/image";
import { useRef, useState } from "react";

type HiPageClientProps = {
  card: CardRecord;
  photoUrl: string | null;
};

export function HiPageClient({ card, photoUrl }: HiPageClientProps) {
  const { pageCopy, copy, contact, links } = card;

  const exchangeButtonRef = useRef<HTMLButtonElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [leadToken, setLeadToken] = useState("");

  const openSheet = () => {
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    exchangeButtonRef.current?.focus();
  };

  const thanksLine =
    connected && !sheetOpen
      ? substituteFirstName(copy.thanksMessage, firstName || "there")
      : null;

  return (
    <div className="relative isolate min-h-svh overflow-hidden bg-bg text-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[200px] left-1/2 z-[-1] h-[420px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-soft),transparent)]"
      />

      <main className="mx-auto flex min-h-svh max-w-[420px] flex-col items-center gap-12 px-6 pb-5 pt-4 text-center [container-type:inline-size]">
        <div className="flex w-full flex-col items-center gap-7">
          <section
            aria-label={contact.name.full}
            className="flex flex-col items-center gap-3.5 pt-[clamp(16px,5svh,48px)]"
          >
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={pageCopy.headshotAlt}
                width={104}
                height={104}
                className="block h-[104px] w-[104px] rounded-full object-cover"
                priority
                unoptimized
              />
            ) : (
              <div
                aria-hidden
                className="h-[104px] w-[104px] rounded-full bg-surface-2 ring-1 ring-line"
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <p className="m-0 text-[1.75rem] font-semibold leading-tight tracking-tight text-accent-text">
                {pageCopy.greetingName}
              </p>
              <p className="m-0 text-[15px] font-medium leading-snug text-ink-muted">
                {contact.title}
              </p>
            </div>
          </section>

          <section
            aria-label={copy.exchangeAriaLabel}
            className="flex w-full flex-col gap-1"
          >
            <Button
              ref={exchangeButtonRef}
              type="button"
              onClick={openSheet}
              className="min-h-14 w-full text-[15px]"
            >
              {pageCopy.exchangeButton}
            </Button>
            {links.bookingUrl && pageCopy.bookLink ? (
              <a
                href={links.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center self-center px-2 text-[15px] font-medium text-ink-muted underline decoration-1 underline-offset-[3px] hover:text-ink"
              >
                {pageCopy.bookLink}
              </a>
            ) : null}
            {thanksLine && (
              <p
                role="status"
                className="m-0 animate-hi-fade text-[15px] font-medium text-accent-text"
              >
                {thanksLine}
              </p>
            )}
          </section>

          <HiAboutSection about={copy.about} />
        </div>

        <nav aria-label={copy.footerNavLabel} className="mt-auto">
          <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-0.5 p-0">
            {links.footer.map((item) => (
              <li key={`${item.kind}-${item.url}`}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-pill px-2 text-[15px] font-medium text-ink-muted no-underline hover:bg-surface-2 hover:text-ink"
                >
                  <SocialProfileIcon kind={item.kind} />
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <HiThemeSwitch />
            </li>
          </ul>
        </nav>
      </main>

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
