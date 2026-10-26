import { WeMetEnvironmentBanner } from "@/components/we-met/WeMetEnvironmentBanner";
import {
  resolveEnvironmentBannerChrome,
  resolveNonProductionBanner,
} from "@/lib/we-met/non-production";

export function WeMetEnvironmentChrome() {
  const chrome = resolveEnvironmentBannerChrome(process.env.NEXT_PUBLIC_WE_MET_ENV);
  const banner = resolveNonProductionBanner(
    process.env.NEXT_PUBLIC_WE_MET_ENV,
    process.env.NEXT_PUBLIC_WE_MET_COMMIT_SHA,
  );

  if (!chrome || !banner) {
    return null;
  }

  return (
    <>
      <style>{chrome.rootStyle}</style>
      <WeMetEnvironmentBanner {...banner} />
    </>
  );
}

export function weMetEnvironmentBodyClassName(): string {
  const chrome = resolveEnvironmentBannerChrome(process.env.NEXT_PUBLIC_WE_MET_ENV);
  return chrome?.bodyClass ?? "";
}
