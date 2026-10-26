import {
  ContactCardIcon,
  CopyIcon,
  LandingIcon,
  QrSampleIcon,
  ReplyIcon,
} from "@/components/landing/LandingIcons";
import {
  LANDING_RELAY_COPY,
  type FollowUpMode,
} from "@/lib/landing/landing-relay-mode";

export function ShareLinkVignette() {
  return (
    <div className="lp-vig">
      <div className="lp-vig-card lp-vig-link">
        <div className="lp-vig-qr">
          <LandingIcon>
            <QrSampleIcon size={104} />
          </LandingIcon>
        </div>
        <div className="lp-vig-url">
          <span>we-met.link/hi/your-name</span>
          <span className="lp-vig-urlbtn">
            <LandingIcon>
              <CopyIcon size={14} />
            </LandingIcon>
          </span>
        </div>
      </div>
    </div>
  );
}

export function ExchangeFormVignette() {
  return (
    <div className="lp-vig">
      <div className="lp-vig-card lp-vig-form">
        <span className="lp-vig-grab" />
        <p className="lp-vig-title">Let&apos;s stay in touch</p>
        <div className="lp-vig-field">
          <span>Full name</span>
          <span>Sam Rivera</span>
        </div>
        <div className="lp-vig-field" data-focus>
          <span>Email</span>
          <span>sam@studio.co</span>
        </div>
        <span className="lp-vig-btn">Exchange contact</span>
      </div>
    </div>
  );
}

function LetterInboxRow({ toSam }: { toSam: boolean }) {
  return (
    <div className="lp-inbox-row" data-unread>
      {toSam ? (
        <span className="lp-vig-av lp-vig-av-soft">YN</span>
      ) : (
        <span className="lp-vig-av">WM</span>
      )}
      <div className="lp-vig-msg">
        <div className="lp-vig-meta">
          <span>{toSam ? "Your Name via We Met" : "We Met"}</span>
          <span>now</span>
        </div>
        <span className="lp-vig-subj">Great meeting you, Sam</span>
        <span className="lp-snip">
          Hi Sam, great meeting you, and thanks for sharing your details with me.
        </span>
        <div className="lp-tags">
          {toSam ? (
            <>
              <span className="lp-tag lp-tag-soft">
                <LandingIcon>
                  <ContactCardIcon size={12} />
                </LandingIcon>
                Contact card
              </span>
              <span className="lp-tag">Sent to Sam</span>
            </>
          ) : (
            <>
              <span className="lp-tag lp-tag-solid">
                <LandingIcon>
                  <ReplyIcon size={12} />
                </LandingIcon>
                Hit Reply to send
              </span>
              <span className="lp-tag lp-tag-soft">
                <LandingIcon>
                  <ContactCardIcon size={12} />
                </LandingIcon>
                {LANDING_RELAY_COPY.relayInboxCardTag}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function YouMetInboxRow() {
  return (
    <div className="lp-inbox-row" data-unread>
      <span className="lp-vig-av">WM</span>
      <div className="lp-vig-msg">
        <div className="lp-vig-meta">
          <span>We Met</span>
          <span>now</span>
        </div>
        <span className="lp-vig-subj">You met Sam Rivera</span>
        <span className="lp-snip">
          sam@studio.co · Product designer · Studio Co · &quot;Met at the design
          meetup&quot;
        </span>
        <div className="lp-tags">
          <span className="lp-tag">All the details, just for you</span>
        </div>
      </div>
    </div>
  );
}

export function FollowUpInboxVignette({ mode }: { mode: FollowUpMode }) {
  return (
    <div className="lp-vig lp-vig-wide">
      <div className="lp-inbox lp-fade" key={mode}>
        <div className="lp-inbox-head">
          <span>Your inbox</span>
          <span className="lp-inbox-count">{mode === "relay" ? "2 new" : "1 new"}</span>
        </div>
        {mode === "relay" && <LetterInboxRow toSam={false} />}
        <YouMetInboxRow />
      </div>
      {mode === "direct" && (
        <div className="lp-vig-mail lp-fade" style={{ marginTop: 14 }}>
          <span className="lp-vig-to">Sam&apos;s inbox</span>
          <div className="lp-inbox">
            <LetterInboxRow toSam />
          </div>
        </div>
      )}
    </div>
  );
}
