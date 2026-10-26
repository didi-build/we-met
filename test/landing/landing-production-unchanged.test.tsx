// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingHome } from "@/components/landing/LandingHome";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { WeMetEnvironmentChrome } from "@/components/we-met/WeMetEnvironmentChrome";
import { resolveLandingMetadata } from "@/lib/landing/metadata";
import { resolveLandingUrls } from "@/lib/landing/urls";

const productionConfig = {
  baseUrl: "https://we-met.link",
  previewHostSuffix: "-we-met.example.workers.dev",
  weMetEnv: "production",
};

const urls = resolveLandingUrls(productionConfig, "https://we-met.link");

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_WE_MET_COMMIT_SHA", "");
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn(function IntersectionObserverStub() {
      return {
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
        takeRecords: vi.fn(),
        root: null,
        rootMargin: "",
        thresholds: [],
      };
    }),
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("production landing unchanged (unit)", () => {
  it("keeps landing metadata without robots overrides", () => {
    const meta = resolveLandingMetadata(productionConfig);
    expect(meta.robots).toBeUndefined();
    expect(meta.title).toBe("We Met: a free digital business card");
  });

  it("does not render an environment banner on the landing page", () => {
    render(
      <>
        <WeMetEnvironmentChrome />
        <ThemeProvider>
          <LandingHome urls={urls} getStartedLabel="Get started" />
        </ThemeProvider>
      </>,
    );
    expect(screen.queryByTestId("we-met-environment-banner")).toBeNull();
    expect(screen.getAllByRole("link", { name: /Get started/ }).length).toBeGreaterThan(
      0,
    );
  });
});
