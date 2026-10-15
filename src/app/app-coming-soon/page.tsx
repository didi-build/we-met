import { AppComingSoon } from "@/components/landing/AppComingSoon";
import { LandingShell } from "@/components/landing/LandingShell";
import { resolveAppComingSoonMetadata } from "@/lib/landing/metadata";
import {
  readLandingBrowseOrigin,
  readLandingHostConfig,
} from "@/lib/landing/server-config";
import { resolveLandingUrls } from "@/lib/landing/urls";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = resolveAppComingSoonMetadata();

export default async function AppComingSoonPage() {
  const config = await readLandingHostConfig();
  const browseOrigin = await readLandingBrowseOrigin(config);
  const urls = resolveLandingUrls(config, browseOrigin);

  return (
    <LandingShell>
      <AppComingSoon urls={urls} />
    </LandingShell>
  );
}
