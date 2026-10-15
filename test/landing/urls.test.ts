import { describe, expect, it } from "vitest";
import { resolveLandingUrls } from "@/lib/landing/urls";

const previewHostSuffix = "-we-met.example.workers.dev";

describe("resolveLandingUrls (unit)", () => {
  it("builds privacy and terms URLs from a production card-site base URL", () => {
    const urls = resolveLandingUrls({
      baseUrl: "https://we-met.link",
      previewHostSuffix,
      weMetEnv: "production",
    });

    expect(urls.privacy).toBe("https://we-met.link/privacy");
    expect(urls.terms).toBe("https://we-met.link/terms");
    expect(urls.exampleCard).toBe("https://we-met.link/hi/didi");
  });

  it("builds privacy and terms URLs from a preview workers.dev base URL", () => {
    const previewBase = "https://pr-35-we-met.example.workers.dev";
    const urls = resolveLandingUrls({
      baseUrl: previewBase,
      previewHostSuffix,
      weMetEnv: "preview",
    });

    expect(urls.privacy).toBe(`${previewBase}/privacy`);
    expect(urls.terms).toBe(`${previewBase}/terms`);
    expect(urls.privacy).not.toBe("/privacy");
    expect(urls.terms).not.toBe("/terms");
  });
});
