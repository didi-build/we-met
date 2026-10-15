import { LandingHome } from "@/components/landing/LandingHome";
import { LandingShell } from "@/components/landing/LandingShell";
import { resolveLandingMetadata } from "@/lib/landing/metadata";
import {
  readLandingBrowseOrigin,
  readLandingHostConfig,
} from "@/lib/landing/server-config";
import { resolveLandingUrls } from "@/lib/landing/urls";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const config = await readLandingHostConfig();
  return resolveLandingMetadata(config);
}

export default async function HomePage() {
  const config = await readLandingHostConfig();
  const browseOrigin = await readLandingBrowseOrigin(config);
  const urls = resolveLandingUrls(config, browseOrigin);

  return (
    <LandingShell>
      <LandingHome urls={urls} getStartedLabel="Get started" />
    </LandingShell>
  );
}
