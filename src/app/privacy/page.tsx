import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingShell } from "@/components/landing/LandingShell";
import { PrivacyPolicyContent } from "@/components/landing/PrivacyPolicyContent";
import { absoluteUrl } from "@/config/we-met";
import { resolvePrivacyMetadata } from "@/lib/landing/metadata";
import {
  readLandingBrowseOrigin,
  readLandingHostConfig,
} from "@/lib/landing/server-config";
import { resolveLandingUrls } from "@/lib/landing/urls";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const config = await readLandingHostConfig();
  return resolvePrivacyMetadata(config);
}

export default async function PrivacyPage() {
  const config = await readLandingHostConfig();
  const browseOrigin = await readLandingBrowseOrigin(config);
  const urls = resolveLandingUrls(config, browseOrigin);
  const cardHiHref = absoluteUrl(browseOrigin, "/hi/");

  return (
    <LandingShell>
      <LandingHeader urls={urls} getStartedLabel="Get started" />
      <PrivacyPolicyContent cardHiHref={cardHiHref} />
      <LandingFooter urls={urls} />
    </LandingShell>
  );
}
