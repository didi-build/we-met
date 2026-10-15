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

export function resolvePrivacyMetadata(config: WeMetHostConfig): Metadata {
  const canonical = absoluteUrl(config.baseUrl, "/privacy");
  const description =
    "How We Met handles your data during the pre-alpha, including sign-in, your card, and contact exchanges.";

  return {
    metadataBase: new URL(config.baseUrl),
    title: "Privacy | We Met",
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: "Privacy | We Met",
      description,
      type: "website",
      url: canonical,
    },
  };
}

export function resolveTermsMetadata(config: WeMetHostConfig): Metadata {
  const canonical = absoluteUrl(config.baseUrl, "/terms");
  const description =
    "Terms for using We Met during the pre-alpha, including your card, link, and email delivery.";

  return {
    metadataBase: new URL(config.baseUrl),
    title: "Terms | We Met",
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: "Terms | We Met",
      description,
      type: "website",
      url: canonical,
    },
  };
}
