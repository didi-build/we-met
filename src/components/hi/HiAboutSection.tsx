"use client";

import { HiWhatIDoChips } from "@/components/hi/HiWhatIDoChips";
import type { CardCopyAbout } from "@/card-data/types";
import { useState } from "react";

type HiAboutSectionProps = {
  about: CardCopyAbout;
};

export function HiAboutSection({ about }: HiAboutSectionProps) {
  const [open, setOpen] = useState(false);

  const [firstExpanded, secondExpanded] = about.expandedParagraphs;
  const consultationParts = secondExpanded?.split(about.consultationHighlight) ?? [];

  return (
    <section
      aria-labelledby="about-title"
      className="w-full rounded-3xl border border-line bg-surface px-6 py-7 text-left"
    >
      <div className="flex flex-col gap-3.5">
        <h2
          id="about-title"
          className="m-0 text-[1.375rem] font-semibold leading-tight tracking-tight"
        >
          {about.title}
        </h2>
        <p className="m-0 text-[17px] leading-relaxed text-ink-muted text-pretty">
          {about.intro}
        </p>
        {open && firstExpanded && (
          <p className="m-0 animate-hi-fade text-[17px] leading-relaxed text-ink-muted text-pretty">
            {firstExpanded}
          </p>
        )}
        {open && secondExpanded && (
          <p className="m-0 animate-hi-fade text-[17px] leading-relaxed text-ink-muted text-pretty">
            {consultationParts.length > 1 ? (
              <>
                {consultationParts[0]}
                <span className="font-semibold text-accent-text">
                  {about.consultationHighlight}
                </span>
                {consultationParts.slice(1).join(about.consultationHighlight)}
              </>
            ) : (
              secondExpanded
            )}
          </p>
        )}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="-my-2 inline-flex min-h-11 items-center self-start border-0 bg-transparent p-0 text-[15px] font-semibold text-accent-text underline decoration-1 underline-offset-[3px] hover:text-ink"
        >
          {open ? about.showLess : about.showMore}
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3.5 border-t border-line pt-6">
        <h3 className="m-0 text-[1.375rem] font-semibold leading-tight tracking-tight">
          {about.whatIDoTitle}
        </h3>
        <HiWhatIDoChips chips={about.chips} />
      </div>
    </section>
  );
}
