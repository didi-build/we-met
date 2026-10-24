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
        followed by your link.
      </p>
      <p className="lp-body">
        <em>People who exchange details with you.</em> When someone taps &quot;Exchange
        contact&quot; on your card, they enter their name and email. On an optional
        second step they can add a phone number, job title, company and a note. We email
        these details to you (Reply-To is the visitor) so you can follow up. We do not
        keep their lead contents in our database. We keep only delivery records: whether
        an email was queued, sent or failed, when, and an error code if it failed.
      </p>
      <p className="lp-body">
        <em>Visitor card pages.</em> After someone submits the optional details step on
        a card, their browser may store a small flag in local storage so we prevent a
        visitor from accidentally sending a duplicate exchange. It contains no personal
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
        Emails we send when you use We Met (like contact-exchange notifications) go
        through Cloudflare Email Service. Cloudflare receives the full message for
        delivery: recipients, sender and reply-to addresses, subject, bodies, and
        attachments. We do not keep the text of these emails in our database.
      </p>

      <h2 className="lp-legal-h2">What the people you meet can see</h2>
      <p className="lp-body">
        By default, we don&apos;t email them your contact card or your Google account
        email address; you follow up from your own inbox, with Reply-To set to them.
      </p>
      <p className="lp-body">
        We recommend creating an exchange on your own card first so you can see what
        visitors will get.
      </p>
      <p className="lp-body">
        When we turn on visitor follow-up email, they may receive a follow-up email from
        your first name via We Met (for example, &quot;Diadem via We Met&quot;). The
        signature shows your Google first name, your display name in brackets when you
        use one, and your Google last name. That email also includes your display name
        on the card (or your Google name if you left display name blank), your role and
        photo, and your contact card attached.
      </p>
      <p className="lp-body">
        When we send that optional follow-up email, if you added a phone number it is
        included in the contact card attached.{" "}
        <strong>
          Your Google account email address is included for visitors who receive that
          optional follow-up:
        </strong>{" "}
        it is in the contact card and replies go to it. The contact card uses your full
        Google name. Don&apos;t create a card if you are not comfortable sharing that
        address when visitor follow-up email is on.
      </p>

      <h2 className="lp-legal-h2">Google Contacts setup</h2>
      <p className="lp-body">
        If you choose &quot;Add We Met to my contacts&quot; after you publish, Google
        will ask you to let We Met see, edit, download and delete your contacts (the
        Google Contacts scope). We use that access only during setup: to create or
        update a single &quot;We Met&quot; contact with our sending addresses. To avoid
        duplicates, we search your contacts only for our sending addresses and read the
        name and email of any match during setup. We don&apos;t keep it. We do not store
        Google access tokens. We only store that you completed setup and which sender
        addresses we recorded on your account.
      </p>
      <p className="lp-body">
        The &quot;We Met&quot; contact stays in your Google Contacts until you delete it
        there, even if you revoke We Met&apos;s access or delete your We Met account.
      </p>
      <p className="lp-body">
        We Met&apos;s use and transfer to any other app of information received from
        Google APIs will adhere to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements:
      </p>
      <p className="lp-body">
        <strong>Limited Use:</strong> Your use of data obtained via the product&apos;s
        specified scopes must comply with the below requirements. These requirements
        apply to the raw data obtained from the scopes and data aggregated, anonymized,
        or derived from them.
      </p>
      <ul className="lp-legal-list">
        <li>
          Limit your use of data to providing or improving user-facing features that are
          prominent in the requesting application&apos;s user interface;
        </li>
        <li>
          Transfers of data are not allowed, except:
          <ul>
            <li>
              To provide or improve your appropriate access or user-facing features that
              are visible and prominent in the requesting application&apos;s user
              interface and only with the user&apos;s consent;
            </li>
            <li>For security purposes (for example, investigating abuse);</li>
            <li>To comply with applicable laws; or,</li>
            <li>
              As part of a merger, acquisition, or sale of assets of the developer after
              obtaining explicit prior consent from the user.
            </li>
          </ul>
        </li>
        <li>
          Don&apos;t allow humans to read the data, unless:
          <ul>
            <li>
              You first obtained the user&apos;s affirmative agreement to view specific
              messages, files, or other data, with the limited exception of use cases
              approved by Google under additional terms applicable to the Nest Device
              Access program;
            </li>
            <li>
              It is necessary for security purposes (for example, investigating a bug or
              abuse);
            </li>
            <li>It is necessary to comply with applicable law; or</li>
            <li>
              The data (including derivations) is aggregated and used for internal
              operations in accordance with applicable privacy and other jurisdictional
              legal requirements.
            </li>
          </ul>
        </li>
      </ul>
      <p className="lp-body">
        All other transfers, uses, or sales of user data are prohibited, including:
      </p>
      <ul className="lp-legal-list">
        <li>
          Transferring or selling user data to third parties like advertising platforms,
          data brokers, or any information resellers.
        </li>
        <li>
          Transferring, selling, or using user data for serving ads, including
          retargeting, personalized or interest-based advertising.
        </li>
        <li>
          Transferring, selling, or using user data to determine credit-worthiness or
          for lending purposes.
        </li>
      </ul>
      <p className="lp-body">
        You must ensure that your employees, agents, contractors, and successors comply
        with this Google API Services User Data Policy.
      </p>
      <p className="lp-body">
        You can revoke We Met&apos;s access to your Google Contacts anytime in your{" "}
        <a href="https://myaccount.google.com/permissions">
          Google Account permissions
        </a>
        .
      </p>

      <h2 className="lp-legal-h2">Who we share data with</h2>
      <p className="lp-body">
        We use Cloudflare to host We Met, store data, pass messages between our systems,
        and send outbound email through Cloudflare Email Service. We use Google so you
        can sign in with Google and for optional one-time Google Contacts access when
        you choose &quot;Add We Met to my contacts&quot;. We don&apos;t sell personal
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
