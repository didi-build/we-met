import {
  absoluteUrl,
  appBaseUrl,
  isCardServingHost,
  isStagingSingleHost,
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
 * On PR previews, `WE_MET_BASE_URL` matches the staging card origin for email and canonical URLs;
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
  let appHome: string;
  if (isStagingSingleHost(config)) {
    appHome = absoluteUrl(new URL(config.baseUrl).origin, "/app");
  } else if (config.weMetEnv === "preview") {
    appHome = absoluteUrl(origin, "/app");
  } else {
    appHome = appBaseUrl(config.baseUrl);
  }
  return {
    siteHome: origin,
    appHome,
    exampleCard: absoluteUrl(origin, "/hi/didi"),
    privacy: absoluteUrl(origin, "/privacy"),
    terms: absoluteUrl(origin, "/terms"),
    didiBuild: "https://didi.build",
  };
}
