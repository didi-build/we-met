import { describe, expect, it } from "vitest";
import { isCardServingHost } from "@/config/we-met";

const PREVIEW_SUFFIX = "-we-met.diademshoukralla.workers.dev";

const config = {
  baseUrl: "https://we-met.link",
  previewHostSuffix: PREVIEW_SUFFIX,
};

describe("isCardServingHost (unit)", () => {
  it("accepts the production card host", () => {
    expect(isCardServingHost("we-met.link", config)).toBe(true);
  });

  it("accepts a verified preview workers.dev host", () => {
    expect(isCardServingHost(`pr-3-we-met.diademshoukralla.workers.dev`, config)).toBe(
      true,
    );
  });

  it("rejects an unrelated hostname", () => {
    expect(isCardServingHost("evil.example.com", config)).toBe(false);
  });

  it("rejects another workers.dev host without the preview suffix", () => {
    expect(isCardServingHost("other-app.account.workers.dev", config)).toBe(false);
  });

  it("rejects we-met.link lookalikes", () => {
    expect(isCardServingHost("not-we-met.link", config)).toBe(false);
    expect(isCardServingHost("we-met.link.evil.com", config)).toBe(false);
  });
});
