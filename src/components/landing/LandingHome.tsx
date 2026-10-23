import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingPhonePreview } from "@/components/landing/LandingPhonePreview";
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
            <p className="lp-lead lp-rise lp-rise-2">
              Share one link or QR code and you both get each other&apos;s details, so
              you never lose a connection and can follow up in your own time.
            </p>
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

        <section
          className="lp-wrap lp-privacy"
          aria-labelledby="privacy-title"
          role="region"
        >
          <div className="lp-privacy-head">
            <p className="lp-eyebrow">Privacy</p>
            <h2 className="lp-h2" id="privacy-title">
              A note on your emails.
            </h2>
          </div>
          <p className="lp-body">
            Emails we send when you use We Met (like contact-exchange notifications) go
            through either our operator&apos;s Google mailbox or Cloudflare Email
            Service; the active provider sees the full message for delivery. We only
            store delivery information (like whether an email was sent), not the
            contents of your leads. When someone exchanges with you, their name and
            email go to your inbox with Reply-To set to them. When we turn on visitor
            follow-up email, they may receive your contact card and your Google account
            email address in that message. Read our <a href={urls.privacy}>Privacy</a>{" "}
            and <a href={urls.terms}>Terms</a> pages for more.
          </p>
        </section>

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
