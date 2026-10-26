import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { weMetEnvironmentBodyClassName } from "@/components/we-met/WeMetEnvironmentChrome";
import {
  ENVIRONMENT_BANNER_BODY_CLASS,
  ENVIRONMENT_BANNER_OFFSET_CSS_VAR,
  resolveEnvironmentBannerChrome,
} from "@/lib/we-met/non-production";

describe("app environment banner offset (unit)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes chrome config only for non-production public env", () => {
    expect(resolveEnvironmentBannerChrome("production")).toBeNull();
    expect(resolveEnvironmentBannerChrome("staging")?.bodyClass).toBe(
      ENVIRONMENT_BANNER_BODY_CLASS,
    );
    expect(resolveEnvironmentBannerChrome("staging")?.rootStyle).toContain(
      ENVIRONMENT_BANNER_OFFSET_CSS_VAR,
    );

    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "production");
    expect(weMetEnvironmentBodyClassName()).toBe("");

    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "staging");
    expect(weMetEnvironmentBodyClassName()).toBe(ENVIRONMENT_BANNER_BODY_CLASS);
  });

  it("offsets sticky app header via a CSS variable with a zero fallback", () => {
    const css = readFileSync("src/app/app-editor.css", "utf8");
    expect(css).toContain("top: var(--we-met-environment-banner-offset, 0);");
    expect(css).toContain(
      "top: calc(64px + var(--we-met-environment-banner-offset, 0px));",
    );
  });
});
