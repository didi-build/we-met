import {
  ContactCardIcon,
  CopyIcon,
  LandingIcon,
  QrSampleIcon,
} from "@/components/landing/LandingIcons";

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

export function LeadEmailVignette() {
  return (
    <div className="lp-vig">
      <div className="lp-vig-mail">
        <span className="lp-vig-to">To you</span>
        <div className="lp-vig-row">
          <span className="lp-vig-av">WM</span>
          <div className="lp-vig-msg">
            <div className="lp-vig-meta">
              <span>We Met</span>
              <span>now</span>
            </div>
            <span className="lp-vig-subj">New lead: Sam Rivera</span>
            <span className="lp-vig-from">sam@studio.co</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VisitorEmailVignette() {
  return (
    <div className="lp-vig">
      <div className="lp-vig-mail">
        <span className="lp-vig-to">To Sam</span>
        <div className="lp-vig-row">
          <span className="lp-vig-av lp-vig-av-soft">YN</span>
          <div className="lp-vig-msg">
            <div className="lp-vig-meta">
              <span>Your Name</span>
              <span>now</span>
            </div>
            <span className="lp-vig-subj">Nice to meet you, Sam</span>
            <span className="lp-vig-att">
              <LandingIcon>
                <ContactCardIcon size={14} />
              </LandingIcon>
              Contact card
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
