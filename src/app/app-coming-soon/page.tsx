import { AppComingSoon } from "@/components/landing/AppComingSoon";
import { LandingShell } from "@/components/landing/LandingShell";
import { resolveAppComingSoonMetadata } from "@/lib/landing/metadata";
import { readLandingHostConfig } from "@/lib/landing/server-config";
import { resolveLandingUrls } from "@/lib/landing/urls";
import type { Metadata } from "next";

export const metadata: Metadata = resolveAppComingSoonMetadata();

export default function AppComingSoonPage() {
  const config = readLandingHostConfig();
  const urls = resolveLandingUrls(config);

  return (
    <LandingShell>
      <AppComingSoon urls={urls} />
    </LandingShell>
  );
}
