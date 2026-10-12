import type { CardRecord } from "@/card-data/types";
import { absoluteUrl, type WeMetHostConfig } from "@/config/we-met";
import { hiVcardPath } from "@/lib/hi-card/paths";
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
      canonical: pagePath,
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
    other: {
      "contact:vcard": absoluteUrl(hostConfig.baseUrl, hiVcardPath(card.slug)),
    },
  };
}
