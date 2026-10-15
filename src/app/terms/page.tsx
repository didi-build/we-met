import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingShell } from "@/components/landing/LandingShell";
import { TermsPolicyContent } from "@/components/landing/TermsPolicyContent";
import { resolveTermsMetadata } from "@/lib/landing/metadata";
import { readLandingHostConfig } from "@/lib/landing/server-config";
import { resolveLandingUrls } from "@/lib/landing/urls";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const config = await readLandingHostConfig();
  return resolveTermsMetadata(config);
}

export default async function TermsPage() {
  const config = await readLandingHostConfig();
  const urls = resolveLandingUrls(config);

  return (
    <LandingShell>
      <LandingHeader urls={urls} getStartedLabel="Get started" />
      <TermsPolicyContent urls={urls} />
      <LandingFooter urls={urls} />
    </LandingShell>
  );
}
