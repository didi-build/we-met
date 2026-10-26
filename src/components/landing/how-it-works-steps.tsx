import type { ReactNode } from "react";
import {
  ExchangeFormVignette,
  ShareLinkVignette,
} from "@/components/landing/HowItWorksVignettes";
import { LANDING_RELAY_COPY } from "@/lib/landing/landing-relay-mode";

export type HowItWorksStep = {
  title: string;
  body: string;
  chip?: string;
  chipSlot?: ReactNode;
  vignettes: ReactNode[];
  extra?: ReactNode;
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
    body: LANDING_RELAY_COPY.step2Body,
    chip: "No app needed",
    vignettes: [<ExchangeFormVignette key="form" />],
  },
];
