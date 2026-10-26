export const NON_PRODUCTION_X_ROBOTS_TAG = "noindex, nofollow";

export type NonProductionBannerLabel = "Staging" | "Preview" | "Local";

export function isProductionWeMetEnv(weMetEnv: string | undefined): boolean {
  return (weMetEnv?.trim() || "production") === "production";
}

export function shouldSendNonProductionXRobotsTag(
  weMetEnv: string | undefined,
): boolean {
  return !isProductionWeMetEnv(weMetEnv);
}

export function resolveNonProductionBannerLabel(
  publicEnv: string | undefined,
): NonProductionBannerLabel | null {
  const env = publicEnv?.trim() || "production";
  if (env === "staging") {
    return "Staging";
  }
  if (env === "preview") {
    return "Preview";
  }
  if (env === "local") {
    return "Local";
  }
  return null;
}

export function shortCommitSha(commitSha: string | undefined): string {
  const trimmed = commitSha?.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.slice(0, 7);
}

export type NonProductionBannerProps = {
  label: NonProductionBannerLabel;
  shortSha: string;
};

export function resolveNonProductionBanner(
  publicEnv: string | undefined,
  commitSha: string | undefined,
): NonProductionBannerProps | null {
  const label = resolveNonProductionBannerLabel(publicEnv);
  if (!label) {
    return null;
  }
  return { label, shortSha: shortCommitSha(commitSha) };
}

export function formatNonProductionBannerText({
  label,
  shortSha,
}: NonProductionBannerProps): string {
  return shortSha ? `${label} · ${shortSha}` : label;
}

export function applyNonProductionXRobotsTag(
  headers: Headers,
  weMetEnv: string | undefined,
): void {
  if (shouldSendNonProductionXRobotsTag(weMetEnv)) {
    headers.set("X-Robots-Tag", NON_PRODUCTION_X_ROBOTS_TAG);
  }
}
