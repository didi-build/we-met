import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingIcon, WeMetMarkIcon } from "@/components/landing/LandingIcons";
import type { LandingUrls } from "@/lib/landing/urls";

export function AppComingSoon({ urls }: { urls: LandingUrls }) {
  return (
    <>
      <LandingHeader urls={urls} getStartedLabel="Get started" showGetStarted={false} />
      <main className="lp-wrap lp-soon">
        <LandingIcon>
          <WeMetMarkIcon size={56} />
        </LandingIcon>
        <h1 className="lp-h2">The We Met app is coming soon.</h1>
        <p className="lp-body">
          Making and editing your card will happen here. Until then, you can see what a
          card looks like.
        </p>
        <div className="lp-actions">
          <a className="lp-btn" href={urls.siteHome}>
            Back to we-met.link
          </a>
          <a className="lp-link" href={urls.exampleCard}>
            See an example
          </a>
        </div>
      </main>
      <LandingFooter urls={urls} />
    </>
  );
}
