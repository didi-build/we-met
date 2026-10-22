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
        <em>Your card.</em> We keep what you put on your card: an optional display name,
        role, photo, about text, services and links, plus an optional phone number and
        any drafts you save. Once you publish, your card is public at we-met.link/hi/
        followed by your link. The phone number is not shown on your public card page.
      </p>
      <p className="lp-body">
        <em>People who exchange details with you.</em> When someone taps &quot;Exchange
        contact&quot; on your card, they enter their name and email, and can add a phone
        number, job title, company and a note. We send these to you by email. We do not
        keep them in our database. We keep only delivery records: whether an email was
        queued, sent or failed, when, and an error code if it failed.
      </p>
      <p className="lp-body">
        <em>Visitor card pages.</em> After someone submits the optional details step on
        a card, their browser may store a small flag in local storage so the exchange
        button shows &quot;Contact sent&quot; on that device. It contains no personal
        data.
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
        first name via We Met (for example, &quot;Diadem via We Met&quot;). The
        signature shows your Google first name, your display name in brackets when you
        use one, and your Google last name. The email also includes your display name on
        the card (or your Google name if you left display name blank), your role and
        photo, and your contact card attached. If you added a phone number, it is
        included in that contact card after an exchange.{" "}
        <strong>
          Your Google account email address is shared with everyone who exchanges
          details with you:
        </strong>{" "}
        replies go to it, and it is in your contact card. The contact card uses your
        full Google name. Don&apos;t create a card if you are not comfortable sharing
        that address.
      </p>

      <h2 className="lp-legal-h2">Who we share data with</h2>
      <p className="lp-body">
        We use Cloudflare to host We Met, store data and pass messages between our
        systems, and Google to sign you in and send email. We don&apos;t sell personal
        information and we don&apos;t use it for advertising.
      </p>
      <p className="lp-body">
        Cloudflare and Google may process personal information in Canada, the United
        States, and other countries where they operate. Their privacy policies describe
        how they handle data outside Canada.
      </p>

      <h2 className="lp-legal-h2">How long we keep it</h2>
      <p className="lp-body">
        We keep your account and card until you ask us to delete them. When you sign in,
        your session lasts up to 30 days of activity, with a hard limit of 90 days from
        when the session started.
      </p>
      <p className="lp-body">
        When someone exchanges details with you, their name, email and optional fields
        may sit in our message queue for up to about 24 hours while we send email. We
        read that retention from our hosting provider&apos;s queue settings (last
        checked October 2026). We do not keep visitor lead contents in our database.
      </p>
      <p className="lp-body">
        Our hosting provider may keep technical logs and traces of how the service runs
        for a short period (for example, about seven days for Workers logs on a paid
        plan, per their pricing page). We do not control trace retention separately in
        our code.
      </p>
      <p className="lp-body">
        Delivery records and daily email send counts do not contain visitor lead
        contents. We keep them after account deletion for operations and limits.
      </p>

      <h2 className="lp-legal-h2">Access and correction</h2>
      <p className="lp-body">
        You can see and edit most of your card in the app while signed in. For a copy of
        personal information we hold about you, or to correct something you cannot
        change in the app, email{" "}
        <a href="mailto:hello@we-met.link">hello@we-met.link</a> from the address you
        signed in with. We respond as soon as we can.
      </p>

      <h2 className="lp-legal-h2">Deleting your data</h2>
      <p className="lp-body">
        To delete your account, email{" "}
        <a href="mailto:hello@we-met.link">hello@we-met.link</a> from the email address
        you signed in with. We remove your card, draft and photo and anonymise your
        account, as soon as we can. Your card link is retired and can&apos;t be used
        again. Delivery records and send counts stay as described above. Copies of
        emails already delivered may remain in mailboxes we do not control. Replaced
        card photos that are no longer linked from your card may remain in storage until
        we add cleanup.
      </p>

      <h2 className="lp-legal-h2">Security breaches</h2>
      <p className="lp-body">
        If a breach of security safeguards creates a real risk of significant harm, we
        will report it to the Office of the Privacy Commissioner of Canada and notify
        affected people as soon as feasible, as required by Canadian privacy law. We
        keep an internal record of breaches involving personal information for 24
        months.
      </p>

      <h2 className="lp-legal-h2">Changes</h2>
      <p className="lp-body">
        We may update this page. The date at the top shows when it last changed.
      </p>
    </main>
  );
}
