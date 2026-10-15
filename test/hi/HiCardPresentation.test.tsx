// @vitest-environment jsdom

import { HiCardPresentation } from "@/components/hi/HiCardPresentation";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { LANDING_CARD_PREVIEW_FIXTURE } from "@/lib/landing/landing-card-preview-fixture";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HiCardPresentation (unit)", () => {
  it("shows free-plan strip and band when plan is free regardless of preview", () => {
    render(
      <ThemeProvider>
        <HiCardPresentation
          card={LANDING_CARD_PREVIEW_FIXTURE}
          photoUrl={null}
          plan="free"
          preview
          interactive
        />
      </ThemeProvider>,
    );
    expect(screen.getAllByText("Get your own card for free").length).toBeGreaterThan(0);
  });

  it("hides strip and band for pro plan while preview only disables exchange", () => {
    const { container } = render(
      <ThemeProvider>
        <HiCardPresentation
          card={LANDING_CARD_PREVIEW_FIXTURE}
          photoUrl={null}
          plan="pro"
          preview
          interactive
        />
      </ThemeProvider>,
    );
    expect(screen.queryByText("Get your own card for free")).toBeNull();
    expect(container.querySelector("button")?.textContent).toContain(
      "Exchange contact",
    );
  });
});
