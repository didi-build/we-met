import { absoluteUrl, appBaseUrl, type WeMetHostConfig } from "@/config/we-met";

export type LandingUrls = {
  siteHome: string;
  appHome: string;
  exampleCard: string;
  didiBuild: string;
};

export function resolveLandingUrls(config: WeMetHostConfig): LandingUrls {
  return {
    siteHome: config.baseUrl.replace(/\/$/, ""),
    appHome: appBaseUrl(config.baseUrl),
    exampleCard: absoluteUrl(config.baseUrl, "/hi/didi"),
    didiBuild: "https://didi.build",
  };
}
