"use client";

import { VISITOR_RECEIPT_COPY } from "@/app-card/default-card-copy";
import { Button } from "@/components/ui/Button";
import {
  HiReceiptCheckIcon,
  HiReceiptContactIcon,
  HiReceiptMailIcon,
  HiReceiptNoteIcon,
  HiReceiptPhoneIcon,
} from "@/components/hi/icons/HiCardIcons";
import { leadPhoneTel } from "@/email/email-template-vars";
import type { HiOwnerContact } from "@/lib/hi-card/hi-page-card";
import {
  formatReceiptContactLine,
  receiptAfterDetailsLine,
  receiptFollowUpLine,
  receiptSaveContactLabel,
  receiptSentToLabel,
  receiptTellMoreLabel,
} from "@/lib/hi-card/visitor-receipt-copy";
import {
  VCARD_DOWNLOAD_FRAME_ID,
  vcardIframeIndicatesApiError,
} from "@/lib/hi-card/vcard-form-download";
import { useEffect, useId, useRef, useState } from "react";

const SAVE_BUSY_MIN_MS = 400;
const VCARD_POST_PATH = "/api/exchange/vcard";

const outlinePillLinkClass =
  "inline-flex min-h-12 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-pill border-[1.5px] border-ink bg-transparent px-4 text-[15px] font-semibold text-ink no-underline transition-colors hover:bg-ink hover:text-bg";

type HiVisitorReceiptProps = {
  ownerFirst: string;
  visitorFirst: string;
  ownerContact: HiOwnerContact | null;
  leadToken: string;
  detailsSent: boolean;
  onTellMore: () => void;
  onVcardFailure: () => void;
};

export function HiVisitorReceipt({
  ownerFirst,
  visitorFirst,
  ownerContact,
  leadToken,
  detailsSent,
  onTellMore,
  onVcardFailure,
}: HiVisitorReceiptProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const allowNativeSubmitRef = useRef(false);
  const pendingDownloadRef = useRef(false);
  const formId = useId();
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveDone, setSaveDone] = useState(false);

  const receiptTimeLabel = detailsSent
    ? VISITOR_RECEIPT_COPY.receiptTimeWithNote
    : VISITOR_RECEIPT_COPY.receiptTimeNow;

  const ownerEmail = ownerContact?.email.trim() ?? "";
  const ownerPhone = ownerContact?.phone.trim() ?? "";
  const phoneTel = ownerPhone ? leadPhoneTel(ownerPhone) : "";
  const contactLine =
    ownerEmail || ownerPhone ? formatReceiptContactLine(ownerEmail, ownerPhone) : null;
  const showContactRow = ownerContact !== null;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }
    const onLoad = () => {
      if (!pendingDownloadRef.current) {
        return;
      }
      pendingDownloadRef.current = false;
      const bodyText = iframe.contentDocument?.body?.textContent ?? "";
      if (vcardIframeIndicatesApiError(bodyText)) {
        allowNativeSubmitRef.current = false;
        setSaveBusy(false);
        setSaveDone(false);
        onVcardFailure();
        return;
      }
      allowNativeSubmitRef.current = false;
      setSaveBusy(false);
      setSaveDone(true);
    };
    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [onVcardFailure]);

  const handleSaveSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!allowNativeSubmitRef.current) {
      event.preventDefault();
      if (saveBusy) {
        return;
      }
      setSaveBusy(true);
      window.setTimeout(() => {
        allowNativeSubmitRef.current = true;
        pendingDownloadRef.current = true;
        formRef.current?.requestSubmit();
      }, SAVE_BUSY_MIN_MS);
      return;
    }
    pendingDownloadRef.current = true;
  };

  const handleSaveAgain = () => {
    setSaveDone(false);
    setSaveBusy(true);
    allowNativeSubmitRef.current = true;
    pendingDownloadRef.current = true;
    formRef.current?.requestSubmit();
  };

  return (
    <div className="animate-hi-fade flex flex-col gap-3">
      <iframe
        ref={iframeRef}
        id={VCARD_DOWNLOAD_FRAME_ID}
        name={VCARD_DOWNLOAD_FRAME_ID}
        title=""
        className="hidden"
        tabIndex={-1}
      />

      <div className="flex items-center justify-between gap-3 rounded-pill border border-line px-4 py-2">
        <div
          role="status"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink"
        >
          <HiReceiptCheckIcon size={16} />
          {receiptSentToLabel(ownerFirst)}
        </div>
        <span className="text-[13px] font-medium text-ink-muted">
          {receiptTimeLabel}
        </span>
      </div>

      <form
        ref={formRef}
        id={formId}
        method="post"
        action={VCARD_POST_PATH}
        target={VCARD_DOWNLOAD_FRAME_ID}
        className="w-full"
        onSubmit={handleSaveSubmit}
      >
        <input type="hidden" name="token" value={leadToken} />
        {saveDone ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-14 w-full gap-3 text-[17px] font-semibold"
            onClick={handleSaveAgain}
          >
            <HiReceiptCheckIcon size={20} />
            {VISITOR_RECEIPT_COPY.saveDone}
          </Button>
        ) : (
          <Button
            type="submit"
            variant="primary"
            aria-busy={saveBusy}
            className="min-h-14 w-full gap-3 text-[17px] font-semibold"
          >
            {saveBusy ? (
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            ) : (
              <HiReceiptContactIcon size={20} />
            )}
            {saveBusy
              ? VISITOR_RECEIPT_COPY.saveBusy
              : receiptSaveContactLabel(ownerFirst)}
          </Button>
        )}
      </form>

      {showContactRow && (
        <div className="grid grid-cols-2 gap-2">
          {ownerEmail ? (
            <a
              className={outlinePillLinkClass}
              href={`mailto:${encodeURIComponent(ownerEmail)}`}
            >
              <HiReceiptMailIcon size={18} />
              {VISITOR_RECEIPT_COPY.emailLink}
            </a>
          ) : (
            <span
              aria-hidden
              className="min-h-12 rounded-pill border border-dashed border-line"
            />
          )}
          {ownerPhone && phoneTel ? (
            <a className={outlinePillLinkClass} href={`tel:${phoneTel}`}>
              <HiReceiptPhoneIcon size={18} />
              {VISITOR_RECEIPT_COPY.callLink}
            </a>
          ) : (
            <span
              aria-hidden
              className="min-h-12 rounded-pill border border-dashed border-line"
            />
          )}
        </div>
      )}

      {contactLine && (
        <p className="m-0 text-center text-[14px] leading-normal text-ink-muted">
          {contactLine}
        </p>
      )}

      <p className="m-0 text-center text-[15px] font-medium leading-normal text-ink-muted">
        {receiptFollowUpLine(ownerFirst)}
      </p>

      {detailsSent ? (
        <p className="animate-hi-fade m-0 text-center text-[14px] font-medium text-ink-muted">
          {receiptAfterDetailsLine(visitorFirst || "there")}
        </p>
      ) : (
        <button
          type="button"
          onClick={onTellMore}
          className="mx-auto inline-flex min-h-11 items-center gap-1.5 rounded-pill px-2 text-[14px] font-medium text-ink-muted underline decoration-1 underline-offset-[3px] hover:text-ink"
        >
          <HiReceiptNoteIcon size={16} />
          {receiptTellMoreLabel(ownerFirst)}
        </button>
      )}
    </div>
  );
}
