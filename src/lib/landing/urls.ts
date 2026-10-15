import { absoluteUrl, appBaseUrl, type WeMetHostConfig } from "@/config/we-met";

export type LandingUrls = {
  siteHome: string;
  appHome: string;
  exampleCard: string;
  privacy: string;
  terms: string;
  didiBuild: string;
};

export function resolveLandingUrls(config: WeMetHostConfig): LandingUrls {
  return {
    siteHome: config.baseUrl.replace(/\/$/, ""),
    appHome: appBaseUrl(config.baseUrl),
    exampleCard: absoluteUrl(config.baseUrl, "/hi/didi"),
    privacy: absoluteUrl(config.baseUrl, "/privacy"),
    terms: absoluteUrl(config.baseUrl, "/terms"),
    didiBuild: "https://didi.build",
  };
}
