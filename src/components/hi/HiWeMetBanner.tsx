import { ArrowRightIcon, WeMetMarkIcon } from "@/components/hi/icons/HiCardIcons";
import { WE_MET_CARD_HOME_URL } from "@/lib/hi-card/card-content";

type HiWeMetBannerTopProps = {
  show: boolean;
};

export function HiWeMetBannerTop({ show }: HiWeMetBannerTopProps) {
  if (!show) {
    return null;
  }
  return (
    <a
      href={WE_MET_CARD_HOME_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-11 items-center justify-center gap-2 bg-ink px-4 text-[14px] font-medium leading-[1.3] text-bg no-underline hover:text-bg"
    >
      <span className="flex items-center gap-1.5 font-bold">
        <WeMetMarkIcon size={16} />
        We Met
      </span>
      <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-current" />
      <span className="hover:underline hover:underline-offset-[3px]">
        Get your own card for free
      </span>
      <span aria-hidden className="inline-flex">
        <ArrowRightIcon size={16} />
      </span>
    </a>
  );
}

type HiWeMetBannerBandProps = {
  show: boolean;
};

export function HiWeMetBannerBand({ show }: HiWeMetBannerBandProps) {
  if (!show) {
    return null;
  }
  return (
    <a
      href={WE_MET_CARD_HOME_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex justify-center bg-ink text-bg no-underline hover:text-bg"
    >
      <span className="flex w-full max-w-[420px] box-border items-center justify-between gap-4 px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6">
        <span className="flex flex-col gap-0.5 text-left">
          <span className="flex items-center gap-1.5 text-[13px] font-bold leading-[1.3] tracking-wide text-[var(--band-label)]">
            <WeMetMarkIcon size={14} />
            We Met
          </span>
          <span className="text-[19px] font-semibold leading-[1.25] tracking-[-0.015em] text-balance">
            Get your own card for free
          </span>
        </span>
        <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill bg-bg px-4 text-[15px] font-semibold leading-none text-ink">
          Start
          <ArrowRightIcon size={16} />
        </span>
      </span>
    </a>
  );
}
