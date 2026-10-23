"use client";

import { Button } from "@/components/ui/Button";
import { HI_CONTACT_SENT_BUTTON_LABEL } from "@/lib/hi-card/contact-sent-label";
import { reloadFallbackLine } from "@/lib/hi-card/visitor-confirmation-copy";

type HiVisitorReloadFallbackProps = {
  ownerName: string;
};

export function HiVisitorReloadFallback({ ownerName }: HiVisitorReloadFallbackProps) {
  return (
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
        {reloadFallbackLine(ownerName)}
      </p>
    </>
  );
}
