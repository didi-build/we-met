// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingHome } from "@/components/landing/LandingHome";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { HOW_IT_WORKS_STEPS } from "@/components/landing/how-it-works-steps";

const urls = {
  siteHome: "https://we-met.link",
  appHome: "https://app.we-met.link",
  exampleCard: "https://we-met.link/hi/didi",
  didiBuild: "https://didi.build",
};

beforeEach(() => {
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
  vi.unstubAllGlobals();
});

function renderLandingHome() {
  return render(
    <ThemeProvider>
      <LandingHome urls={urls} getStartedLabel="Get started" />
    </ThemeProvider>,
  );
}

describe("LandingHome (unit)", () => {
  it("renders Get started and See an example links with configured URLs", () => {
    renderLandingHome();

    const getStarted = screen.getAllByRole("link", { name: /Get started/ });
    expect(getStarted.length).toBeGreaterThan(0);
    for (const link of getStarted) {
      expect(link.getAttribute("href")).toBe(urls.appHome);
    }

    const example = screen.getByRole("link", { name: "See an example" });
    expect(example.getAttribute("href")).toBe(urls.exampleCard);
  });

  it("renders how-it-works chip copy", () => {
    renderLandingHome();

    for (const step of HOW_IT_WORKS_STEPS) {
      expect(screen.getAllByText(step.chip).length).toBeGreaterThan(0);
    }
  });
});
