"use client";

import { HiCardPresentation } from "@/components/hi/HiCardPresentation";
import type { HiCardCtaMode } from "@/components/hi/HiCardPresentation";
import { HiExchangeSheet } from "@/components/hi/HiExchangeSheet";
import { HiStickyExchangeBar } from "@/components/hi/HiStickyExchangeBar";
import type { CardPlan } from "@/card-data/types";
import { cardInitials } from "@/lib/hi-card/card-content";
import { isDetailsTokenExpired } from "@/lib/hi-card/details-token-client";
import {
  readDetailsSentFlag,
  writeDetailsSentFlag,
} from "@/lib/hi-card/details-sent-storage";
import {
  clearExchangeSession,
  readExchangeCompletedFlag,
  readExchangeSession,
  writeExchangeCompletedFlag,
  writeExchangeSession,
} from "@/lib/hi-card/exchange-session-storage";
import { captureSheetOpener, restoreSheetFocus } from "@/lib/hi-card/sheet-focus";
import type { HiOwnerContact, HiPageCard } from "@/lib/hi-card/hi-page-card";
import type { HiExchangeOwnerContact } from "@/components/hi/hi-exchange-api";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type HiPageClientProps = {
  card: HiPageCard;
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
  const [visitorFirst, setVisitorFirst] = useState("");
  const [leadToken, setLeadToken] = useState("");
  const [ownerContact, setOwnerContact] = useState<HiOwnerContact | null>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [detailsSent, setDetailsSent] = useState(false);
  const [exchangeCompleted, setExchangeCompleted] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  const degradeToReloadFallback = useCallback(() => {
    clearExchangeSession(card.slug);
    setSessionActive(false);
    setLeadToken("");
    setOwnerContact(null);
  }, [card.slug]);

  useEffect(() => {
    setDetailsSent(readDetailsSentFlag(card.slug));
    setExchangeCompleted(readExchangeCompletedFlag(card.slug));
    const session = readExchangeSession(card.slug);
    if (!session) {
      return;
    }
    if (isDetailsTokenExpired(session.leadToken)) {
      clearExchangeSession(card.slug);
      return;
    }
    setSessionActive(true);
    setVisitorFirst(session.firstName);
    setLeadToken(session.leadToken);
  }, [card.slug]);

  const markDetailsSent = useCallback(() => {
    writeDetailsSentFlag(card.slug);
    setDetailsSent(true);
  }, [card.slug]);

  const showReceipt = sessionActive && Boolean(leadToken);
  const showReloadFallback = exchangeCompleted && !showReceipt;
  const hideStickyExchange = showReceipt || showReloadFallback;

  const ctaMode: HiCardCtaMode = useMemo(() => {
    if (showReceipt) {
      return {
        kind: "receipt",
        visitorFirst,
        ownerContact,
        leadToken,
        detailsSent,
        onTellMore: () => {
          sheetOpenerRef.current = null;
          pendingSheetFocusRestoreRef.current = false;
          setSheetOpen(true);
        },
        onVcardFailure: degradeToReloadFallback,
      };
    }
    if (showReloadFallback) {
      return { kind: "reload-fallback" };
    }
    return { kind: "exchange" };
  }, [
    showReceipt,
    showReloadFallback,
    visitorFirst,
    ownerContact,
    leadToken,
    detailsSent,
    degradeToReloadFallback,
  ]);

  const updateStickyFromScroll = useCallback(() => {
    const el = ctaRef.current;
    if (!el) {
      return;
    }
    setStickyVisible(el.getBoundingClientRect().top < 0);
  }, []);

  const openSheet = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (showReloadFallback || detailsSent) {
        return;
      }
      sheetOpenerRef.current = captureSheetOpener(event.currentTarget);
      pendingSheetFocusRestoreRef.current = true;
      setSheetOpen(true);
    },
    [detailsSent, showReloadFallback],
  );

  const closeSheet = useCallback(() => {
    updateStickyFromScroll();
    const opener = sheetOpenerRef.current;
    if (stickyExchangeButtonRef.current && opener === stickyExchangeButtonRef.current) {
      setStickyVisible(true);
    }
    setSheetOpen(false);
  }, [updateStickyFromScroll]);

  const handleExchangeSuccess = useCallback(
    (
      nextFirstName: string,
      token: string,
      owner: HiExchangeOwnerContact,
      visitorEmail: string,
    ) => {
      setVisitorFirst(nextFirstName);
      setLeadToken(token);
      setOwnerContact({ email: owner.email, phone: owner.phone });
      setSessionActive(true);
      setExchangeCompleted(true);
      writeExchangeSession(card.slug, {
        firstName: nextFirstName,
        visitorEmail,
        leadToken: token,
      });
      writeExchangeCompletedFlag(card.slug);
    },
    [card.slug],
  );

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
    if (sheetOpen || hideStickyExchange) {
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
  }, [sheetOpen, hideStickyExchange, updateStickyFromScroll]);

  const sheetInitialStep = showReceipt ? "details" : "exchange";

  return (
    <>
      <HiStickyExchangeBar
        visible={stickyVisible && !sheetOpen && !hideStickyExchange}
        name={card.name}
        role={card.role}
        initials={initials}
        photoUrl={photoUrl}
        photoAlt={card.pageCopy.headshotAlt}
        exchangeButtonRef={stickyExchangeButtonRef}
        onExchange={openSheet}
        exchangeLocked={showReloadFallback || detailsSent}
      />

      <HiCardPresentation
        card={card}
        photoUrl={photoUrl}
        plan={plan}
        exchangeButtonRef={exchangeButtonRef}
        ctaRef={ctaRef}
        onOpenExchange={openSheet}
        thanksLine={null}
        detailsSent={detailsSent}
        ctaMode={ctaMode}
      />

      <HiExchangeSheet
        slug={card.slug}
        copy={copy.exchangeSheet}
        open={sheetOpen}
        initialStep={sheetInitialStep}
        firstName={visitorFirst}
        leadToken={leadToken}
        onClose={closeSheet}
        onExchangeSuccess={handleExchangeSuccess}
        onDetailsSuccess={markDetailsSent}
      />
    </>
  );
}
