import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingPhonePreview } from "@/components/landing/LandingPhonePreview";
import { LANDING_RELAY_COPY } from "@/lib/landing/landing-relay-mode";
import type { LandingUrls } from "@/lib/landing/urls";

type LandingHomeProps = {
  urls: LandingUrls;
  getStartedLabel: string;
};

export function LandingHome({ urls, getStartedLabel }: LandingHomeProps) {
  return (
    <>
      <LandingHeader urls={urls} getStartedLabel={getStartedLabel} />
      <main>
        <section className="lp-wrap lp-hero" aria-labelledby="hero-title">
          <div className="lp-hero-text">
            <p className="lp-eyebrow lp-rise">Free digital business card</p>
            <h1 className="lp-h1 lp-rise lp-rise-1" id="hero-title">
              <span>Meet someone.</span>
              <span>Swap details.</span>
              <span>Easy.</span>
            </h1>
            <p className="lp-lead lp-rise lp-rise-2">{LANDING_RELAY_COPY.heroLead}</p>
            <div className="lp-actions lp-rise lp-rise-3">
              <a className="lp-btn" href={urls.appHome}>
                {getStartedLabel}
                <span aria-hidden="true">→</span>
              </a>
              <a className="lp-link" href={urls.exampleCard}>
                See an example
              </a>
            </div>
          </div>
          <LandingPhonePreview />
        </section>

        <HowItWorksSection />

        <section className="lp-wrap lp-final" aria-labelledby="cta-title">
          <div className="lp-final-panel">
            <h2 className="lp-h2" id="cta-title">
              Make your card before your next event.
            </h2>
            <p className="lp-body">
              It&apos;s free to start, and it takes one link to share.
            </p>
            <a className="lp-btn" href={urls.appHome}>
              {getStartedLabel}
            </a>
          </div>
        </section>
      </main>
      <LandingFooter urls={urls} />
    </>
  );
}
