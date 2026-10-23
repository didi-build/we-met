import type { ReactNode } from "react";
import {
  ExchangeFormVignette,
  LeadEmailVignette,
  ShareLinkVignette,
} from "@/components/landing/HowItWorksVignettes";

export type HowItWorksStep = {
  title: string;
  body: string;
  chip: string;
  vignettes: ReactNode[];
};

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    title: "Share your link",
    body: "Show your QR code or send your link. Your card lives at we-met.link/hi/your-name.",
    chip: "Works from a QR code or a link",
    vignettes: [<ShareLinkVignette key="share" />],
  },
  {
    title: "They exchange contact details",
    body: "The person you met taps Exchange contact and adds their name and email.",
    chip: "No app needed",
    vignettes: [<ExchangeFormVignette key="form" />],
  },
  {
    title: "Follow up from your inbox",
    body: "Their name and email land in your inbox. Reply-To is them so you can follow up.",
    chip: "You get all the lead details",
    vignettes: [<LeadEmailVignette key="lead" />],
  },
];
