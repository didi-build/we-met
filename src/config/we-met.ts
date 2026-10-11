export type WeMetHostConfig = {
  baseUrl: string;
  previewHostSuffix: string | null;
};

function requireNonEmpty(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing required config: ${name}`);
  }
  return trimmed;
}

export function readWeMetHostConfig(env: {
  WE_MET_BASE_URL?: string;
  WE_MET_PREVIEW_HOST_SUFFIX?: string;
}): WeMetHostConfig {
  const baseUrl = requireNonEmpty("WE_MET_BASE_URL", env.WE_MET_BASE_URL);
  const previewHostSuffix = env.WE_MET_PREVIEW_HOST_SUFFIX?.trim() || null;
  return { baseUrl, previewHostSuffix };
}

export function baseUrlHostname(baseUrl: string): string {
  return new URL(baseUrl).hostname.toLowerCase();
}

export function isCardServingHost(hostname: string, config: WeMetHostConfig): boolean {
  const host = hostname.toLowerCase().split(":")[0] ?? "";
  if (host === "localhost" || host === "127.0.0.1") {
    return true;
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
