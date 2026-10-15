"use client";

import { useState } from "react";

type HiCardAboutProps = {
  title: string;
  paragraphs: string[];
};

export function HiCardAbout({ title, paragraphs }: HiCardAboutProps) {
  const [open, setOpen] = useState(false);
  const first = paragraphs[0] ?? "";
  const rest = paragraphs.slice(1);
  const showMore = rest.length > 0;

  return (
    <div className="flex flex-col gap-3.5">
      <h2 className="m-0 text-[1.375rem] font-semibold leading-tight tracking-tight">
        {title}
      </h2>
      <p className="m-0 text-[17px] leading-relaxed text-ink-muted text-pretty">
        {first}
      </p>
      {open &&
        rest.map((p) => (
          <p
            key={p.slice(0, 24)}
            className="m-0 animate-hi-fade text-[17px] leading-relaxed text-ink-muted text-pretty"
          >
            {p}
          </p>
        ))}
      {showMore && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="-my-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 self-start border-0 bg-transparent p-0 text-[15px] font-semibold text-ink underline decoration-1 underline-offset-[3px] hover:text-ink-muted"
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
