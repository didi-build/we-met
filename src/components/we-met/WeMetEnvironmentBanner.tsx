import {
  formatNonProductionBannerText,
  type NonProductionBannerProps,
} from "@/lib/we-met/non-production";

export function WeMetEnvironmentBanner(props: NonProductionBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="we-met-environment-banner"
      className="fixed inset-x-0 top-0 z-[300] border-b border-line-strong bg-accent-soft px-3 py-1.5 text-center text-sm font-semibold text-accent-text"
    >
      {formatNonProductionBannerText(props)}
    </div>
  );
}
