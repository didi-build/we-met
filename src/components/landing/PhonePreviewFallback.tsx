export function PhonePreviewFallback() {
  return (
    <div className="lp-phone lp-rise-phone" aria-hidden="true">
      <div className="lp-phone-screen">
        <div className="lp-phone-content">
          <div className="lp-fb">
            <div className="lp-fb-card">
              <div className="lp-fb-head">
                <span className="lp-fb-avatar">DS</span>
                <div>
                  <p className="lp-fb-greet">I&apos;m Didi</p>
                  <p className="lp-fb-role">Software Engineer and Technical Advisor</p>
                </div>
              </div>
              <span className="lp-fb-btn">Exchange contact</span>
              <span className="lp-fb-rule" />
              <div>
                <p className="lp-fb-h">About me</p>
                <p className="lp-fb-p">
                  I&apos;m a software engineer in Toronto. I help founders who built
                  their app with AI get it ready for real users, paying customers, or
                  investors.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
