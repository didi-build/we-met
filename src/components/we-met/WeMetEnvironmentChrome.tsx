import { WeMetEnvironmentBanner } from "@/components/we-met/WeMetEnvironmentBanner";
import { resolveNonProductionBanner } from "@/lib/we-met/non-production";

export function WeMetEnvironmentChrome() {
  const banner = resolveNonProductionBanner(
    process.env.NEXT_PUBLIC_WE_MET_ENV,
    process.env.NEXT_PUBLIC_WE_MET_COMMIT_SHA,
  );

  if (!banner) {
    return null;
  }

  return <WeMetEnvironmentBanner {...banner} />;
}

export function weMetEnvironmentBodyClassName(): string {
  const banner = resolveNonProductionBanner(
    process.env.NEXT_PUBLIC_WE_MET_ENV,
    process.env.NEXT_PUBLIC_WE_MET_COMMIT_SHA,
  );
  return banner ? "pt-9" : "";
}
