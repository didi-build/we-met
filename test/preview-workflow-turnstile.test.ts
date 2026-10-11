import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Turnstile site keys in deploy workflows (unit)", () => {
  const preview = readFileSync(".github/workflows/preview.yml", "utf8");
  const production = readFileSync(".github/workflows/deploy-production.yml", "utf8");

  it("preview workflow uses non-prod Turnstile repository variable", () => {
    expect(preview).toContain("vars.WE_MET_TURNSTILE_SITE_KEY_NONPROD");
    expect(preview).not.toContain("WE_MET_TURNSTILE_SITE_KEY_PRODUCTION");
  });

  it("production workflow uses production Turnstile variable", () => {
    expect(production).toContain("vars.WE_MET_TURNSTILE_SITE_KEY_PRODUCTION");
    expect(production).not.toContain("WE_MET_TURNSTILE_SITE_KEY_NONPROD");
  });
});
