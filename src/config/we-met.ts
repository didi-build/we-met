export type WeMetEnv = "local" | "preview" | "staging" | "production";

export type WeMetHostConfig = {
  baseUrl: string;
  previewHostSuffix: string | null;
  weMetEnv: string;
};

const ALLOWED_WE_MET_ENV = new Set<WeMetEnv>([
  "local",
  "preview",
  "staging",
  "production",
]);

function requireNonEmpty(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing required config: ${name}`);
  }
  return trimmed;
}

function normalizeWeMetEnv(raw: string | undefined): WeMetEnv {
  const value = (raw?.trim() || "production") as WeMetEnv;
  if (!ALLOWED_WE_MET_ENV.has(value)) {
    throw new Error(`Invalid WE_MET_ENV: ${raw?.trim() ?? ""}`);
  }
  return value;
}

export function readWeMetHostConfig(env: {
  WE_MET_BASE_URL?: string;
  WE_MET_PREVIEW_HOST_SUFFIX?: string;
  WE_MET_ENV?: string;
}): WeMetHostConfig {
  const baseUrl = requireNonEmpty("WE_MET_BASE_URL", env.WE_MET_BASE_URL);
  const weMetEnv = normalizeWeMetEnv(env.WE_MET_ENV);
  const previewHostSuffix = env.WE_MET_PREVIEW_HOST_SUFFIX?.trim() || null;
  if (weMetEnv === "staging" && previewHostSuffix) {
    throw new Error(
      "WE_MET_PREVIEW_HOST_SUFFIX must not be set when WE_MET_ENV is staging",
    );
  }
  return { baseUrl, previewHostSuffix, weMetEnv };
}

export function baseUrlHostname(baseUrl: string): string {
  return new URL(baseUrl).hostname.toLowerCase();
}

export function isCardServingHost(hostname: string, config: WeMetHostConfig): boolean {
  const host = hostname.toLowerCase().split(":")[0] ?? "";
  if (host === "localhost" || host === "127.0.0.1") {
    return config.weMetEnv === "local";
  }
  if (host === baseUrlHostname(config.baseUrl)) {
    return true;
  }
  if (config.previewHostSuffix && host.endsWith(config.previewHostSuffix)) {
    return true;
  }
  return false;
}

export function absoluteUrl(baseUrl: string, path: string): string {
  const origin = baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
}

/** In staging the app host is the card base host (single-host deploy). */
export function isStagingSingleHost(config: WeMetHostConfig): boolean {
  return config.weMetEnv === "staging";
}

/** Authenticated app host for a card-site base URL (e.g. `https://we-met.link` → `app.we-met.link`). */
export function appHostForBaseUrl(baseUrl: string): string {
  const cardHost = baseUrlHostname(baseUrl);
  return `app.${cardHost}`;
}

/** Hostname that serves the authenticated app SPA and app API routes. */
export function appServingHostname(config: WeMetHostConfig): string {
  if (isStagingSingleHost(config)) {
    return baseUrlHostname(config.baseUrl);
  }
  return appHostForBaseUrl(config.baseUrl);
}

export function appBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.hostname = appHostForBaseUrl(baseUrl);
  return url.origin;
}

export function isAppServingHost(hostname: string, config: WeMetHostConfig): boolean {
  const host = hostname.toLowerCase().split(":")[0] ?? "";
  return host === appServingHostname(config);
}
