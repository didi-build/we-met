import type { LandingUrls } from "@/lib/landing/urls";
import {
  DidiBuildLeafIcon,
  LandingIcon,
  WeMetMarkIcon,
} from "@/components/landing/LandingIcons";
import { LandingThemeSwitch } from "@/components/landing/LandingThemeSwitch";

export function LandingFooter({ urls }: { urls: LandingUrls }) {
  return (
    <footer className="lp-wrap">
      <div className="lp-footer-in">
        <div className="lp-footer-left">
          <span className="lp-footer-brand">
            <LandingIcon>
              <WeMetMarkIcon size={20} />
            </LandingIcon>
            We Met
          </span>
          <nav className="lp-footer-nav" aria-label="Legal">
            <a href={urls.privacy}>Privacy</a>
            <a href={urls.terms}>Terms</a>
          </nav>
          <span className="lp-credit">
            Free digital business cards, made by{" "}
            <a className="lp-credit-link" href={urls.didiBuild}>
              <LandingIcon>
                <DidiBuildLeafIcon size={12} />
              </LandingIcon>
              Didi Build
            </a>
            .
          </span>
        </div>
        <LandingThemeSwitch />
      </div>
    </footer>
  );
}
