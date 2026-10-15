import type { LandingUrls } from "@/lib/landing/urls";
import { LandingIcon, WeMetMarkIcon } from "@/components/landing/LandingIcons";

type LandingHeaderProps = {
  urls: LandingUrls;
  getStartedLabel: string;
  showGetStarted?: boolean;
};

export function LandingHeader({
  urls,
  getStartedLabel,
  showGetStarted = true,
}: LandingHeaderProps) {
  return (
    <header className="lp-wrap lp-header">
      <a className="lp-brand" href={urls.siteHome} aria-label="We Met home">
        <LandingIcon>
          <WeMetMarkIcon size={26} />
        </LandingIcon>
        We Met
      </a>
      {showGetStarted ? (
        <a className="lp-btn lp-btn-sm" href={urls.appHome}>
          {getStartedLabel}
        </a>
      ) : null}
    </header>
  );
}
