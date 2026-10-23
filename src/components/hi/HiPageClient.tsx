"use client";

import { HiCardPresentation } from "@/components/hi/HiCardPresentation";
import { HiExchangeSheet } from "@/components/hi/HiExchangeSheet";
import { HiStickyExchangeBar } from "@/components/hi/HiStickyExchangeBar";
import type { CardPlan, CardRecord } from "@/card-data/types";
import { cardInitials } from "@/lib/hi-card/card-content";
import { substituteFirstName } from "@/lib/copy/substitute-first-name";
import {
  readExchangeCompletedFlag,
  writeExchangeCompletedFlag,
} from "@/lib/hi-card/exchange-completed-storage";
import {
  readExchangeSession,
  writeExchangeSession,
} from "@/lib/hi-card/exchange-session-storage";
import {
  readDetailsSentFlag,
  writeDetailsSentFlag,
} from "@/lib/hi-card/details-sent-storage";
import { captureSheetOpener, restoreSheetFocus } from "@/lib/hi-card/sheet-focus";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type HiPageClientProps = {
  card: CardRecord;
  photoUrl: string | null;
  plan?: CardPlan;
};

export function HiPageClient({ card, photoUrl, plan = "free" }: HiPageClientProps) {
  const { copy } = card;
  const initials = cardInitials(card.name);

  const exchangeButtonRef = useRef<HTMLButtonElement>(null);
  const stickyExchangeButtonRef = useRef<HTMLButtonElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const sheetOpenerRef = useRef<HTMLElement | null>(null);
  const pendingSheetFocusRestoreRef = useRef(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [leadToken, setLeadToken] = useState("");
  const [stickyVisible, setStickyVisible] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [exchangeCompletedPersisted, setExchangeCompletedPersisted] = useState(false);

  useEffect(() => {
    setContactSent(readDetailsSentFlag(card.slug));
    setExchangeCompletedPersisted(readExchangeCompletedFlag(card.slug));
    const session = readExchangeSession(card.slug);
    if (session) {
      setConnected(true);
      setFirstName(session.firstName);
      setLeadToken(session.leadToken);
    }
  }, [card.slug]);

  const hasActiveExchangeSession = Boolean(leadToken);
  const showVisitorReceipt = hasActiveExchangeSession && connected;
  const showVisitorReloadFallback =
    exchangeCompletedPersisted && !hasActiveExchangeSession;

  const markContactSent = useCallback(() => {
    writeDetailsSentFlag(card.slug);
    setContactSent(true);
  }, [card.slug]);

  const updateStickyFromScroll = useCallback(() => {
    const el = ctaRef.current;
    if (!el) {
      return;
    }
    setStickyVisible(el.getBoundingClientRect().top < 0);
  }, []);

  const openSheet = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (contactSent || showVisitorReloadFallback) {
        return;
      }
      sheetOpenerRef.current = captureSheetOpener(event.currentTarget);
      pendingSheetFocusRestoreRef.current = true;
      setSheetOpen(true);
    },
    [contactSent, showVisitorReloadFallback],
  );

  const openDetailsFromReceipt = useCallback(() => {
    if (contactSent || showVisitorReloadFallback) {
      return;
    }
    pendingSheetFocusRestoreRef.current = true;
    setSheetOpen(true);
  }, [contactSent, showVisitorReloadFallback]);

  const closeSheet = useCallback(() => {
    updateStickyFromScroll();
    const opener = sheetOpenerRef.current;
    if (stickyExchangeButtonRef.current && opener === stickyExchangeButtonRef.current) {
      setStickyVisible(true);
    }
    setSheetOpen(false);
  }, [updateStickyFromScroll]);

  useEffect(() => {
    if (sheetOpen || !pendingSheetFocusRestoreRef.current) {
      return;
    }
    pendingSheetFocusRestoreRef.current = false;
    const opener = sheetOpenerRef.current;
    const fallback = exchangeButtonRef.current;
    const id = window.requestAnimationFrame(() => {
      restoreSheetFocus(opener, fallback);
    });
    return () => window.cancelAnimationFrame(id);
  }, [sheetOpen]);

  useEffect(() => {
    if (sheetOpen) {
      setStickyVisible(false);
      return;
    }
    const onScroll = () => updateStickyFromScroll();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sheetOpen, updateStickyFromScroll]);

  const thanksLine =
    connected && !sheetOpen && !showVisitorReceipt
      ? substituteFirstName(copy.thanksMessage, firstName || "there")
      : null;

  return (
    <>
      <HiStickyExchangeBar
        visible={
          stickyVisible &&
          !sheetOpen &&
          !showVisitorReceipt &&
          !showVisitorReloadFallback
        }
        name={card.name}
        role={card.role}
        initials={initials}
        photoUrl={photoUrl}
        photoAlt={card.pageCopy.headshotAlt}
        exchangeButtonRef={stickyExchangeButtonRef}
        onExchange={openSheet}
        contactSent={contactSent}
      />

      <HiCardPresentation
        card={card}
        photoUrl={photoUrl}
        plan={plan}
        exchangeButtonRef={exchangeButtonRef}
        ctaRef={ctaRef}
        onOpenExchange={openSheet}
        thanksLine={thanksLine}
        contactSent={contactSent}
        showVisitorReceipt={showVisitorReceipt}
        showVisitorReloadFallback={showVisitorReloadFallback}
        visitorFirstName={firstName}
        onTellOwnerMore={openDetailsFromReceipt}
      />

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
          writeExchangeSession(card.slug, {
            firstName: nextFirstName,
            leadToken: token,
          });
          writeExchangeCompletedFlag(card.slug);
          setExchangeCompletedPersisted(true);
        }}
        onDetailsSuccess={markContactSent}
      />
    </>
  );
}
