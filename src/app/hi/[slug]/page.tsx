import { HiPageClient } from "@/components/hi/HiPageClient";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readWeMetHostConfig } from "@/config/we-met";
import { hiPhotoPath } from "@/lib/hi-card/paths";
import { toHiPageCard } from "@/lib/hi-card/hi-page-card";
import { resolveHiCardPage } from "@/lib/hi-card/resolve-card-route";
import { resolveHiCardMetadata } from "@/lib/hi/page-metadata";
import type { Metadata } from "next";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const card = await resolveHiCardPage(slug);
  const { env } = await getCloudflareContext({ async: true });
  const hostConfig = readWeMetHostConfig(env);
  return resolveHiCardMetadata(card, hostConfig);
}

export default async function HiCardPage({ params }: PageProps) {
  const { slug } = await params;
  const card = await resolveHiCardPage(slug);

  const photoUrl = card.photoKey ? hiPhotoPath(slug) : null;

  return <HiPageClient card={toHiPageCard(card)} photoUrl={photoUrl} />;
}
