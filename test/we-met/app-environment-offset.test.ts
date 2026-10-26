import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { weMetEnvironmentBodyClassName } from "@/components/we-met/WeMetEnvironmentChrome";
import {
  ENVIRONMENT_BANNER_BODY_CLASS,
  ENVIRONMENT_BANNER_OFFSET_CSS,
  ENVIRONMENT_BANNER_OFFSET_CSS_VAR,
  resolveEnvironmentBannerChrome,
} from "@/lib/we-met/non-production";

describe("app environment banner offset (unit)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes chrome config only for non-production public env", () => {
    expect(resolveEnvironmentBannerChrome("production")).toBeNull();
    expect(resolveEnvironmentBannerChrome("staging")).toEqual({
      bodyClass: ENVIRONMENT_BANNER_BODY_CLASS,
      rootStyle: `:root{${ENVIRONMENT_BANNER_OFFSET_CSS_VAR}:${ENVIRONMENT_BANNER_OFFSET_CSS};}`,
    });

    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "production");
    expect(weMetEnvironmentBodyClassName()).toBe("");

    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "staging");
    expect(weMetEnvironmentBodyClassName()).toBe(ENVIRONMENT_BANNER_BODY_CLASS);
  });

  it("uses 2.25rem for the fixed banner height constant", () => {
    expect(ENVIRONMENT_BANNER_OFFSET_CSS).toBe("2.25rem");
    const bannerSource = readFileSync(
      "src/components/we-met/WeMetEnvironmentBanner.tsx",
      "utf8",
    );
    expect(bannerSource).toContain("ENVIRONMENT_BANNER_OFFSET_CSS");
    expect(bannerSource).not.toContain("h-9");
  });

  it("offsets sticky app chrome via a CSS variable with a zero fallback", () => {
    const appCss = readFileSync("src/app/app-editor.css", "utf8");
    expect(appCss).toContain("top: var(--we-met-environment-banner-offset, 0);");
    expect(appCss).toContain(
      "top: calc(64px + var(--we-met-environment-banner-offset, 0px));",
    );
    expect(appCss).toContain(
      "top: calc(96px + var(--we-met-environment-banner-offset, 0px));",
    );

    const globalsCss = readFileSync("src/app/globals.css", "utf8");
    expect(globalsCss).toContain("body.we-met-env-banner");
    expect(globalsCss).toContain(
      "padding-top: var(--we-met-environment-banner-offset);",
    );
  });
});
