"use client";

import {
  HiCheckIcon,
  HiContactCardIcon,
  HiMailIcon,
  HiNoteIcon,
  HiPhoneIcon,
} from "@/components/hi/icons/HiReceiptIcons";
import { Button } from "@/components/ui/Button";
import { leadPhoneTel } from "@/email/email-template-vars";
import {
  detailsAddedThanks,
  ownerFollowUpLine,
  saveOwnerContactLabel,
  sentToOwnerLabel,
  tellOwnerMoreLabel,
} from "@/lib/hi-card/visitor-confirmation-copy";
import { useCallback, useState } from "react";

type HiVisitorConfirmationReceiptProps = {
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  visitorFirstName: string;
  detailsAdded: boolean;
  onTellMore: () => void;
  onSaveContact: () => void;
};

const outlineButtonClass = "min-h-12 w-full px-4 text-[15px] font-semibold";

export function HiVisitorConfirmationReceipt({
  ownerName,
  ownerEmail,
  ownerPhone,
  visitorFirstName,
  detailsAdded,
  onTellMore,
  onSaveContact,
}: HiVisitorConfirmationReceiptProps) {
  const [saveBusy, setSaveBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const phone = ownerPhone?.trim() ?? "";
  const showPhone = phone.length > 0;
  const contactLine = showPhone ? `${ownerEmail} · ${phone}` : ownerEmail;

  const handleSave = useCallback(() => {
    if (saveBusy) {
      return;
    }
    setSaveBusy(true);
    try {
      onSaveContact();
      setSaved(true);
    } finally {
      window.setTimeout(() => setSaveBusy(false), 400);
    }
  }, [onSaveContact, saveBusy]);

  return (
    <div className="flex animate-hi-fade flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-pill border border-line px-4 py-2">
        <span
          role="status"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink"
        >
          <HiCheckIcon size={16} />
          {sentToOwnerLabel(ownerName)}
        </span>
        <span className="text-[13px] font-medium text-ink-muted">
          {detailsAdded ? "With your note" : "Just now"}
        </span>
      </div>

      <Button
        type="button"
        variant={saved ? "outline" : "primary"}
        onClick={handleSave}
        aria-busy={saveBusy}
        className="min-h-14 w-full text-[17px]"
      >
        {saveBusy ? (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
        ) : saved ? (
          <HiCheckIcon size={20} />
        ) : (
          <HiContactCardIcon size={20} />
        )}
        {saveBusy
          ? "Preparing contact"
          : saved
            ? "Saved, tap to save again"
            : saveOwnerContactLabel(ownerName)}
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={`mailto:${ownerEmail}`}
          className={`${outlineButtonClass} inline-flex min-h-11 items-center justify-center gap-2.5 whitespace-nowrap rounded-pill border-[1.5px] border-ink bg-transparent text-ink no-underline transition-colors hover:bg-ink hover:text-bg`}
        >
          <HiMailIcon size={18} />
          Email
        </a>
        {showPhone ? (
          <a
            href={`tel:${leadPhoneTel(phone)}`}
            className={`${outlineButtonClass} inline-flex min-h-11 items-center justify-center gap-2.5 whitespace-nowrap rounded-pill border-[1.5px] border-ink bg-transparent text-ink no-underline transition-colors hover:bg-ink hover:text-bg`}
          >
            <HiPhoneIcon size={18} />
            Call
          </a>
        ) : (
          <span
            aria-hidden
            className="min-h-12 rounded-pill border border-dashed border-line"
          />
        )}
      </div>

      <p className="m-0 text-center text-[14px] leading-normal text-ink-muted">
        {contactLine}
      </p>

      <p className="m-0 text-center text-[15px] font-medium leading-normal text-ink-muted">
        {ownerFollowUpLine(ownerName)}
      </p>

      {!detailsAdded ? (
        <button
          type="button"
          onClick={onTellMore}
          className="mx-auto inline-flex min-h-11 items-center gap-1.5 rounded-pill px-2 text-[14px] font-medium text-ink-muted underline decoration-1 underline-offset-[3px] transition-colors hover:text-ink"
        >
          <HiNoteIcon size={16} />
          {tellOwnerMoreLabel(ownerName)}
        </button>
      ) : (
        <p className="m-0 animate-hi-fade text-center text-[14px] font-medium text-ink-muted">
          {detailsAddedThanks(visitorFirstName)}
        </p>
      )}
    </div>
  );
}
