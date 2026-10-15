import { LandingHome } from "@/components/landing/LandingHome";
import { LandingShell } from "@/components/landing/LandingShell";
import { resolveLandingMetadata } from "@/lib/landing/metadata";
import { readLandingHostConfig } from "@/lib/landing/server-config";
import { resolveLandingUrls } from "@/lib/landing/urls";
import type { Metadata } from "next";

export function generateMetadata(): Metadata {
  const config = readLandingHostConfig();
  return resolveLandingMetadata(config);
}

export default function HomePage() {
  const config = readLandingHostConfig();
  const urls = resolveLandingUrls(config);

  return (
    <LandingShell>
      <LandingHome urls={urls} getStartedLabel="Get started" />
    </LandingShell>
  );
}
