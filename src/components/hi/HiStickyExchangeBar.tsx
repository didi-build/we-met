"use client";

import { Button } from "@/components/ui/Button";
import Image from "next/image";

type HiStickyExchangeBarProps = {
  visible: boolean;
  name: string;
  role?: string;
  initials: string;
  photoUrl: string | null;
  photoAlt: string;
  onExchange: () => void;
};

export function HiStickyExchangeBar({
  visible,
  name,
  role,
  initials,
  photoUrl,
  photoAlt,
  onExchange,
}: HiStickyExchangeBarProps) {
  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 top-0 z-10 flex justify-center border-b border-line bg-bg transition-transform duration-200 ${
        visible ? "translate-y-0 visible" : "-translate-y-full invisible"
      }`}
    >
      <div className="flex w-full max-w-[420px] items-center gap-3 px-4 py-2.5 pl-5">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={photoAlt}
            width={36}
            height={36}
            className="block h-9 w-9 shrink-0 rounded-full object-cover bg-surface-2"
            unoptimized
          />
        ) : (
          <div
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-xs font-semibold text-ink"
          >
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1 text-left">
          <p className="m-0 truncate text-[15px] font-semibold leading-snug text-ink">
            {name}
          </p>
          {role && (
            <p className="m-0 truncate text-[13px] font-medium leading-snug text-ink-muted">
              {role}
            </p>
          )}
        </div>
        <div className="relative isolate shrink-0">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 rounded-pill"
            style={{
              animation: visible
                ? "hi-ring-pulse-sm 2.6s 0.4s linear infinite"
                : undefined,
            }}
          />
          <Button type="button" onClick={onExchange} className="min-h-10 px-6 text-sm">
            Exchange
          </Button>
        </div>
      </div>
    </div>
  );
}
