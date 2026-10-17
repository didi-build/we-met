import type { CardRecord } from "@/card-data/types";
import { absoluteUrl, type WeMetHostConfig } from "@/config/we-met";
import type { Metadata } from "next";

export function resolveHiCardMetadata(
  card: CardRecord,
  hostConfig: WeMetHostConfig,
): Metadata {
  const pagePath = `/hi/${card.slug}`;
  const pageUrl = absoluteUrl(hostConfig.baseUrl, pagePath);

  return {
    title: card.pageCopy.pageTitle,
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: card.pageCopy.pageTitle,
      url: pageUrl,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: card.pageCopy.pageTitle,
    },
  };
}
