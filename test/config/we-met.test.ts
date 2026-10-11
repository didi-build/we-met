import { describe, expect, it } from "vitest";
import { isCardServingHost } from "@/config/we-met";

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
