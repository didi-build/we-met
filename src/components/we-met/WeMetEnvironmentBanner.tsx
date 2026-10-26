import {
  formatNonProductionBannerText,
  type NonProductionBannerProps,
} from "@/lib/we-met/non-production";

export function WeMetEnvironmentBanner(props: NonProductionBannerProps) {
  return (
    <div
      role="note"
      data-testid="we-met-environment-banner"
      className="fixed inset-x-0 top-0 z-[300] flex h-9 items-center justify-center border-b border-line-strong bg-accent-soft px-3 text-center text-sm font-semibold leading-6 text-accent-text"
    >
      {formatNonProductionBannerText(props)}
    </div>
  );
}
