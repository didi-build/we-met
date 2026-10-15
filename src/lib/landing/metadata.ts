import { absoluteUrl, type WeMetHostConfig } from "@/config/we-met";
import type { Metadata } from "next";

const LANDING_TITLE = "We Met: a free digital business card";
const LANDING_DESCRIPTION =
  "A free digital business card. Share one link or QR code and you both get each other's details.";
const OG_IMAGE_ALT = "We Met — free digital business cards";

export function resolveLandingMetadata(config: WeMetHostConfig): Metadata {
  const canonical = config.baseUrl.replace(/\/$/, "");
  const ogImage = absoluteUrl(config.baseUrl, "/og-image.png");

  return {
    metadataBase: new URL(config.baseUrl),
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    alternates: {
      canonical,
    },
    openGraph: {
      title: "We Met",
      description: LANDING_DESCRIPTION,
      type: "website",
      url: canonical,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: OG_IMAGE_ALT,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogImage],
    },
  };
}

export function resolveAppComingSoonMetadata(): Metadata {
  return {
    title: "We Met app: coming soon",
    description: "The We Met app is coming soon.",
    robots: { index: false, follow: false },
  };
}
