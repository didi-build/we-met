export function PrivacyPolicyContent() {
  return (
    <main className="lp-wrap lp-legal">
      <h1 className="lp-legal-h1">Privacy</h1>
      <p className="lp-legal-intro">
        <em>We Met is in pre-alpha. This page may change as the product does.</em>
      </p>
      <p className="lp-legal-updated">Last updated: October 2026</p>

      <h2 className="lp-legal-h2">Who we are</h2>
      <p className="lp-body">
        We Met is a free digital business card made by Didi Build (&quot;we&quot;,
        &quot;us&quot;). You can reach us at{" "}
        <a href="mailto:hello@we-met.link">hello@we-met.link</a>.
      </p>

      <h2 className="lp-legal-h2">What we collect</h2>
      <p className="lp-body">
        <em>When you sign in.</em> We sign you in with Google. We receive your Google
        account ID, your email address and your name. We never see your Google password,
        and we don&apos;t keep Google access tokens.
      </p>
      <p className="lp-body">
        <em>Your card.</em> We keep what you put on your card: your name, role, photo,
        about text, services and links, plus any drafts you save. Once you publish, your
        card is public at we-met.link/hi/ followed by your link.
      </p>
      <p className="lp-body">
        <em>People who exchange details with you.</em> When someone taps &quot;Exchange
        contact&quot; on your card, they enter their name and email, and can add a phone
        number, job title, company and a note. We send these to you by email. We do not
        keep them in our database. We keep only delivery records: whether an email was
        queued, sent or failed, when, and an error code if it failed.
      </p>
      <p className="lp-body">
        <em>Counts and technical data.</em> We keep daily counts of how many emails we
        send, per card and overall, so we stay within sending limits. Our hosting and
        security providers process technical data such as IP addresses to run the
        service and block abuse.
      </p>
      <p className="lp-body">
        <em>If sign-ups are closed.</em> If you sign in while sign-ups are closed, we
        keep your Google account ID, email address and name so we can let you in when
        they open.
      </p>

      <h2 className="lp-legal-h2">Who can see the emails</h2>
      <p className="lp-body">
        Emails from We Met are sent through our operator&apos;s mailbox, so the operator
        can technically see them. We don&apos;t store their contents in our database. We
        plan to move email sending to a separate service.
      </p>

      <h2 className="lp-legal-h2">What the people you meet can see</h2>
      <p className="lp-body">
        When someone exchanges details with you, they get a follow-up email from your
        first name via We Met (for example, &quot;Diadem via We Met&quot;) with your
        Google first name, last name and display name in brackets when you use one, plus
        your role and photo, and your contact card attached.{" "}
        <strong>
          Your Google account email address is shared with everyone who exchanges
          details with you:
        </strong>{" "}
        replies go to it, and it is in your contact card. Don&apos;t create a card if
        you are not comfortable sharing that address.
      </p>

      <h2 className="lp-legal-h2">Who we share data with</h2>
      <p className="lp-body">
        We use Cloudflare to host We Met, store data and pass messages between our
        systems, and Google to sign you in and send email. We don&apos;t sell personal
        information and we don&apos;t use it for advertising.
      </p>

      <h2 className="lp-legal-h2">How long we keep it</h2>
      <p className="lp-body">
        We keep your account and card until you ask us to delete them. Delivery records
        and daily counts contain no lead contents and are kept.
      </p>

      <h2 className="lp-legal-h2">Deleting your data</h2>
      <p className="lp-body">
        To delete your account, email{" "}
        <a href="mailto:hello@we-met.link">hello@we-met.link</a> from the email address
        you signed in with. We remove your card, draft and photo and anonymise your
        account, as soon as we can. Your card link is retired and can&apos;t be used
        again.
      </p>

      <h2 className="lp-legal-h2">Changes</h2>
      <p className="lp-body">
        We may update this page. The date at the top shows when it last changed.
      </p>
    </main>
  );
}
