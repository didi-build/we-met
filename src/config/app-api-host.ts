import {
  appBaseUrl,
  isAppServingHost,
  isStagingSingleHost,
  type WeMetHostConfig,
} from "@/config/we-met";

function hostLabel(hostname: string): string {
  return hostname.toLowerCase().split(":")[0] ?? "";
}

/** Hosts that may serve `/api/app/*` and `/api/auth/*` (ADR 0025 §6). */
export function isAppApiServingHost(
  hostname: string,
  config: WeMetHostConfig,
): boolean {
  const host = hostLabel(hostname);
  if (isAppServingHost(hostname, config)) {
    return true;
  }
  if (host === "localhost" || host === "127.0.0.1") {
    return config.weMetEnv === "local";
  }
  if (config.previewHostSuffix && host.endsWith(config.previewHostSuffix)) {
    return true;
  }
  return false;
}

function requireAppOrigin(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing required config: ${name}`);
  }
  return trimmed.replace(/\/$/, "");
}

/**
 * Browser origin for the app SPA and OAuth redirects (never derived from untrusted hosts
 * except the preview suffix rule in ADR 0025 §3).
 */
export function resolveAppOrigin(
  config: WeMetHostConfig,
  requestUrl: string,
  env: { WE_MET_APP_ORIGIN?: string },
): string {
  const url = new URL(requestUrl);
  const host = hostLabel(url.hostname);

  if (config.weMetEnv === "local") {
    return requireAppOrigin("WE_MET_APP_ORIGIN", env.WE_MET_APP_ORIGIN);
  }
  if (config.weMetEnv === "staging") {
    return new URL(config.baseUrl).origin;
  }
  if (config.previewHostSuffix && host.endsWith(config.previewHostSuffix)) {
    return url.origin;
  }
  return appBaseUrl(config.baseUrl);
}

/** Where to send the browser after a redirect-mode Google sign-in. */
export function appSpaPath(config: WeMetHostConfig, hostname: string): string {
  if (isAppServingHost(hostname, config) && !isStagingSingleHost(config)) {
    return "/";
  }
  return "/app";
}
