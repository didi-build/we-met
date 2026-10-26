// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout from "@/app/layout";
import {
  ENVIRONMENT_BANNER_OFFSET_CSS,
  ENVIRONMENT_BANNER_OFFSET_CSS_VAR,
} from "@/lib/we-met/non-production";

vi.mock("next/font/local", () => ({
  default: () => ({
    variable: "font-figtree",
  }),
}));

describe("RootLayout environment chrome (unit)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders no banner chrome in production", () => {
    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "production");
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>Page</p>
      </RootLayout>,
    );
    expect(html).not.toContain("we-met-env-banner");
    expect(html).not.toContain("we-met-environment-banner");
    expect(html).not.toContain(ENVIRONMENT_BANNER_OFFSET_CSS_VAR);
  });

  it("renders staging banner chrome on the layout body", () => {
    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_WE_MET_COMMIT_SHA", "abc1234");
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>Page</p>
      </RootLayout>,
    );
    expect(html).toContain(
      'class="font-figtree min-h-dvh antialiased we-met-env-banner"',
    );
    expect(html).toContain(
      `:root{${ENVIRONMENT_BANNER_OFFSET_CSS_VAR}:${ENVIRONMENT_BANNER_OFFSET_CSS};}`,
    );
    expect(html).toContain('data-testid="we-met-environment-banner"');
    expect(html).toContain("Staging abc1234");
  });
});
