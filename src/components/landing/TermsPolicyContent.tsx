import type { LandingUrls } from "@/lib/landing/urls";

export function TermsPolicyContent({ urls }: { urls: LandingUrls }) {
  return (
    <main className="lp-wrap lp-legal">
      <h1 className="lp-legal-h1">Terms</h1>
      <p className="lp-legal-intro">
        <em>We Met is in pre-alpha. These terms may change.</em>
      </p>
      <p className="lp-legal-updated">Last updated: October 2026</p>

      <h2 className="lp-legal-h2">Using We Met</h2>
      <p className="lp-body">
        We Met is a free digital business card made by Didi Build. By signing in or
        using a card, you agree to these terms. If you don&apos;t agree, please
        don&apos;t use We Met.
      </p>

      <h2 className="lp-legal-h2">Pre-alpha</h2>
      <p className="lp-body">
        We Met is an early version. It is provided as is and as available. Features can
        change or stop, and we don&apos;t promise that every email is delivered or that
        the service is always available. Don&apos;t rely on We Met as your only way to
        keep a contact.
      </p>

      <h2 className="lp-legal-h2">Your card and your content</h2>
      <p className="lp-body">
        You are responsible for what you put on your card, and you must have the right
        to share it. Don&apos;t use We Met for anything unlawful, misleading or abusive,
        to impersonate someone, or to send unwanted messages. We may suspend or remove a
        card or account at any time, with or without notice, for example to protect
        people or the service.
      </p>

      <h2 className="lp-legal-h2">Your link</h2>
      <p className="lp-body">
        The link you choose when you first publish can&apos;t be changed in this
        version. If an account is deleted or removed, its link is retired and not
        reused.
      </p>

      <h2 className="lp-legal-h2">Emails</h2>
      <p className="lp-body">
        We Met emails the card owner when someone exchanges contact details (Reply-To is
        the visitor so the owner can follow up). We Met may email the visitor a
        follow-up when that optional mode is on. We limit how many emails can be sent
        and may pause sending at any time.
      </p>

      <h2 className="lp-legal-h2">Privacy</h2>
      <p className="lp-body">
        How we handle data is described on the <a href={urls.privacy}>privacy page</a>.
      </p>

      <h2 className="lp-legal-h2">Liability</h2>
      <p className="lp-body">
        To the extent the law allows, We Met and Didi Build aren&apos;t liable for lost
        leads or contacts, missed or delayed emails, or other indirect losses from using
        We Met.
      </p>

      <h2 className="lp-legal-h2">Contact</h2>
      <p className="lp-body">
        <a href="mailto:hello@we-met.link">hello@we-met.link</a>
      </p>
    </main>
  );
}
