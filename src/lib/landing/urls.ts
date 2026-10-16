import {
  absoluteUrl,
  appBaseUrl,
  isCardServingHost,
  type WeMetHostConfig,
} from "@/config/we-met";

export type LandingUrls = {
  siteHome: string;
  appHome: string;
  exampleCard: string;
  privacy: string;
  terms: string;
  didiBuild: string;
};

/**
 * Origin for same-site marketing navigation (footer legal links, header home, example card).
 * On PR previews, `WE_MET_BASE_URL` stays the production card origin for email/canonical URLs;
 * when the request is served on a preview card host, browse links use the request origin instead.
 */
export function resolveLandingBrowseOrigin(
  config: WeMetHostConfig,
  requestHost: string,
  protocol: "http" | "https" = "https",
): string {
  const cardOrigin = config.baseUrl.replace(/\/$/, "");
  const host = requestHost.trim();
  if (!host) {
    return cardOrigin;
  }

  const useRequestOrigin =
    (config.weMetEnv === "preview" || config.weMetEnv === "local") &&
    isCardServingHost(host, config);

  if (useRequestOrigin) {
    return `${protocol}://${host}`;
  }

  return cardOrigin;
}

export function resolveLandingUrls(
  config: WeMetHostConfig,
  browseOrigin?: string,
): LandingUrls {
  const origin = (browseOrigin ?? config.baseUrl).replace(/\/$/, "");
  return {
    siteHome: origin,
    appHome: appBaseUrl(config.baseUrl),
    exampleCard: absoluteUrl(origin, "/hi/didi"),
    privacy: absoluteUrl(origin, "/privacy"),
    terms: absoluteUrl(origin, "/terms"),
    didiBuild: "https://didi.build",
  };
}
