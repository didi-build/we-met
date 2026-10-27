import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseJsonc } from "../../scripts/lib/parse-jsonc.mjs";
import { resolveLandingBrowseOrigin, resolveLandingUrls } from "@/lib/landing/urls";

const wranglerPreviewsVars = (
  parseJsonc(readFileSync("wrangler.jsonc", "utf8")) as {
    previews: { vars: Record<string, string> };
  }
).previews.vars;

const previewHostSuffix = wranglerPreviewsVars.WE_MET_PREVIEW_HOST_SUFFIX;

const productionCardConfig = {
  baseUrl: "https://we-met.link",
  previewHostSuffix,
  weMetEnv: "production",
};

const previewWorkerConfig = {
  baseUrl: wranglerPreviewsVars.WE_MET_BASE_URL,
  previewHostSuffix,
  weMetEnv: wranglerPreviewsVars.WE_MET_ENV,
};

const stagingCardConfig = {
  baseUrl: "https://we-met.didi.build",
  previewHostSuffix: null,
  weMetEnv: "staging",
};

describe("resolveLandingBrowseOrigin (unit)", () => {
  it("uses the production card origin on the production card host", () => {
    expect(
      resolveLandingBrowseOrigin(productionCardConfig, "we-met.link", "https"),
    ).toBe("https://we-met.link");
  });

  it("uses the request origin on a preview workers.dev card host", () => {
    const previewHost = `pr-35${previewHostSuffix}`;
    expect(resolveLandingBrowseOrigin(previewWorkerConfig, previewHost, "https")).toBe(
      `https://${previewHost}`,
    );
  });

  it("keeps the configured card origin on the app host (legal pages are not served there)", () => {
    expect(
      resolveLandingBrowseOrigin(previewWorkerConfig, "app.we-met.link", "https"),
    ).toBe(wranglerPreviewsVars.WE_MET_BASE_URL);
  });
});

describe("resolveLandingUrls (unit)", () => {
  it("builds privacy and terms from the configured base URL when no browse origin is passed", () => {
    const urls = resolveLandingUrls(productionCardConfig);

    expect(urls.privacy).toBe("https://we-met.link/privacy");
    expect(urls.terms).toBe("https://we-met.link/terms");
    expect(urls.exampleCard).toBe("https://we-met.link/hi/didi");
  });

  it("builds privacy and terms from an explicit preview browse origin", () => {
    const previewOrigin = `https://pr-35${previewHostSuffix}`;
    const urls = resolveLandingUrls(previewWorkerConfig, previewOrigin);

    expect(urls.privacy).toBe(`${previewOrigin}/privacy`);
    expect(urls.terms).toBe(`${previewOrigin}/terms`);
    expect(urls.privacy).not.toBe("/privacy");
    expect(urls.terms).not.toBe("/terms");
    expect(urls.appHome).toBe(`${previewOrigin}/app`);
    expect(urls.appHome).not.toContain("app.we-met.didi.build");
    expect(urls.appHome).not.toContain("we-met.link");
  });

  it("uses /app on the staging card origin for appHome", () => {
    const urls = resolveLandingUrls(stagingCardConfig);
    expect(urls.appHome).toBe("https://we-met.didi.build/app");
    expect(urls.appHome).not.toContain("app.we-met.didi.build");
  });
});
