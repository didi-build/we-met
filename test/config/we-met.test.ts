import { describe, expect, it } from "vitest";
import {
  appBaseUrl,
  appHostForBaseUrl,
  isAppServingHost,
  isCardServingHost,
  readWeMetHostConfig,
} from "@/config/we-met";

const PREVIEW_SUFFIX = "-we-met.diademshoukralla.workers.dev";

const productionConfig = {
  baseUrl: "https://we-met.link",
  previewHostSuffix: PREVIEW_SUFFIX,
  weMetEnv: "production",
};

const localConfig = {
  ...productionConfig,
  weMetEnv: "local",
};

describe("isCardServingHost (unit)", () => {
  it("accepts the production card host", () => {
    expect(isCardServingHost("we-met.link", productionConfig)).toBe(true);
  });

  it("accepts a verified preview workers.dev host", () => {
    expect(
      isCardServingHost(`pr-3-we-met.diademshoukralla.workers.dev`, productionConfig),
    ).toBe(true);
  });

  it("rejects localhost unless WE_MET_ENV is local", () => {
    expect(isCardServingHost("localhost", productionConfig)).toBe(false);
    expect(isCardServingHost("127.0.0.1", productionConfig)).toBe(false);
    expect(isCardServingHost("localhost", localConfig)).toBe(true);
    expect(isCardServingHost("127.0.0.1", localConfig)).toBe(true);
  });

  it("rejects an unrelated hostname", () => {
    expect(isCardServingHost("evil.example.com", productionConfig)).toBe(false);
  });

  it("rejects another workers.dev host without the preview suffix", () => {
    expect(isCardServingHost("other-app.account.workers.dev", productionConfig)).toBe(
      false,
    );
  });

  it("rejects we-met.link lookalikes", () => {
    expect(isCardServingHost("not-we-met.link", productionConfig)).toBe(false);
    expect(isCardServingHost("we-met.link.evil.com", productionConfig)).toBe(false);
  });
});

describe("readWeMetHostConfig (unit)", () => {
  it("defaults missing WE_MET_ENV to production", () => {
    const config = readWeMetHostConfig({ WE_MET_BASE_URL: "https://we-met.link" });
    expect(config.weMetEnv).toBe("production");
  });

  it("throws on invalid WE_MET_ENV values", () => {
    expect(() =>
      readWeMetHostConfig({
        WE_MET_BASE_URL: "https://we-met.link",
        WE_MET_ENV: "unknown",
      }),
    ).toThrow(/Invalid WE_MET_ENV/);
  });

  it("accepts preview workers.dev hosts when base URL is staging origin", () => {
    const previewConfig = readWeMetHostConfig({
      WE_MET_BASE_URL: "https://we-met.didi.build",
      WE_MET_ENV: "preview",
      WE_MET_PREVIEW_HOST_SUFFIX: PREVIEW_SUFFIX,
    });
    expect(isCardServingHost("we-met.didi.build", previewConfig)).toBe(true);
    expect(isCardServingHost(`pr-3${PREVIEW_SUFFIX}`, previewConfig)).toBe(true);
  });

  it("rejects staging when WE_MET_PREVIEW_HOST_SUFFIX is set", () => {
    expect(() =>
      readWeMetHostConfig({
        WE_MET_BASE_URL: "https://we-met.didi.build",
        WE_MET_ENV: "staging",
        WE_MET_PREVIEW_HOST_SUFFIX: "-we-met.example.workers.dev",
      }),
    ).toThrow(/WE_MET_PREVIEW_HOST_SUFFIX/);
  });
});

describe("app host helpers (unit)", () => {
  it("derives app.we-met.link from the card base URL", () => {
    expect(appHostForBaseUrl("https://we-met.link")).toBe("app.we-met.link");
    expect(appBaseUrl("https://we-met.link")).toBe("https://app.we-met.link");
  });

  it("recognises the production app host only", () => {
    expect(isAppServingHost("app.we-met.link", productionConfig)).toBe(true);
    expect(isAppServingHost("we-met.link", productionConfig)).toBe(false);
    expect(isAppServingHost("app.evil.com", productionConfig)).toBe(false);
  });
});
