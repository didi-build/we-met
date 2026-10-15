import { describe, expect, it } from "vitest";
import {
  resolveAppComingSoonMetadata,
  resolveLandingMetadata,
} from "@/lib/landing/metadata";

const previewConfig = {
  baseUrl: "https://pr-29-we-met.example.workers.dev",
  previewHostSuffix: "-we-met.example.workers.dev",
  weMetEnv: "preview",
};

describe("resolveLandingMetadata (unit)", () => {
  it("sets title, description, canonical, and absolute social image URLs from base URL config", () => {
    const meta = resolveLandingMetadata(previewConfig);

    expect(meta.title).toBe("We Met: a free digital business card");
    expect(meta.description).toBe(
      "A free digital business card. Share one link or QR code and you both get each other's details.",
    );
    expect(meta.alternates?.canonical).toBe(previewConfig.baseUrl);
    expect(meta.metadataBase?.toString()).toBe(`${previewConfig.baseUrl}/`);

    const ogImages = meta.openGraph?.images;
    const ogImage = Array.isArray(ogImages) ? ogImages[0] : ogImages;
    expect(ogImage).toMatchObject({
      url: `${previewConfig.baseUrl}/og-image.png`,
      width: 1200,
      height: 630,
      alt: "We Met — free digital business cards",
    });
    expect(meta.openGraph && "type" in meta.openGraph && meta.openGraph.type).toBe(
      "website",
    );
    expect(meta.openGraph && "url" in meta.openGraph && meta.openGraph.url).toBe(
      previewConfig.baseUrl,
    );

    expect(meta.twitter && "card" in meta.twitter && meta.twitter.card).toBe(
      "summary_large_image",
    );
    expect(meta.twitter && "images" in meta.twitter && meta.twitter.images).toEqual([
      `${previewConfig.baseUrl}/og-image.png`,
    ]);
  });

  it("marks the app coming-soon page as noindex", () => {
    const meta = resolveAppComingSoonMetadata();
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
