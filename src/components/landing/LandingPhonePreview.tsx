import { HiCardPresentation } from "@/components/hi/HiCardPresentation";
import {
  LANDING_CARD_PREVIEW_FIXTURE,
  LANDING_CARD_PREVIEW_PHOTO_URL,
} from "@/lib/landing/landing-card-preview-fixture";

export function LandingPhonePreview() {
  return (
    <div className="lp-phone lp-rise-phone" aria-hidden="true">
      <div className="lp-phone-screen">
        <div className="lp-phone-content">
          <HiCardPresentation
            card={LANDING_CARD_PREVIEW_FIXTURE}
            photoUrl={LANDING_CARD_PREVIEW_PHOTO_URL}
            plan="pro"
            preview
            embedded
          />
        </div>
      </div>
    </div>
  );
}
