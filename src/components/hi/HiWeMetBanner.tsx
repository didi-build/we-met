import { WE_MET_CARD_HOME_URL } from "@/lib/hi-card/card-content";

function BannerArrow() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

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
      className="hi-banner-link flex min-h-11 items-center justify-center gap-2 bg-ink px-4 text-[14px] font-medium leading-snug no-underline hover:underline hover:underline-offset-[3px]"
    >
      <span className="font-bold">We Met</span>
      <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-current" />
      <span>Get your own card for free</span>
      <span aria-hidden className="flex">
        <BannerArrow />
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
          <span
            className="text-[13px] font-bold leading-snug tracking-wide"
            style={{ color: "color-mix(in oklch, var(--bg) 72%, var(--ink))" }}
          >
            We Met
          </span>
          <span className="text-[19px] font-semibold leading-tight tracking-tight text-balance text-bg">
            Get your own card for free
          </span>
        </span>
        <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill bg-bg px-4 text-[15px] font-semibold text-ink">
          Start
          <BannerArrow />
        </span>
      </span>
    </a>
  );
}
