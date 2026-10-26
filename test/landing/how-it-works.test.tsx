// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HOW_IT_WORKS_INTERSECTION_OPTIONS } from "@/components/landing/how-it-works-observer";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { LANDING_RELAY_COPY } from "@/lib/landing/landing-relay-mode";

describe("HowItWorksSection (unit)", () => {
  let observerCallback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
    observerCallback = null;
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn(function IntersectionObserverMock(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        observerCallback = callback;
        expect(options).toEqual(HOW_IT_WORKS_INTERSECTION_OPTIONS);
        return {
          observe: vi.fn(),
          disconnect: vi.fn(),
          unobserve: vi.fn(),
          takeRecords: vi.fn(),
          root: null,
          rootMargin: options?.rootMargin ?? "",
          thresholds: [],
        };
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("activates the step reported by IntersectionObserver", () => {
    render(<HowItWorksSection />);
    expect(observerCallback).toBeTruthy();

    const steps = document.querySelectorAll(".lp-step");
    act(() => {
      observerCallback?.(
        [
          {
            isIntersecting: true,
            target: steps[2]!,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });

    expect(steps[2]?.getAttribute("data-active")).toBe("true");
    expect(
      document.querySelector('[data-layer="2"]')?.getAttribute("data-active"),
    ).toBe("true");
  });

  it("disables transitions under prefers-reduced-motion in landing CSS", () => {
    const css = readFileSync("src/components/landing/landing.css", "utf8");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.lp \*[\s\S]*transition:\s*none !important/,
    );
  });

  it("defaults to relay step 3 copy and vignette subjects", () => {
    render(<HowItWorksSection />);

    expect(
      screen.getAllByRole("heading", {
        level: 3,
        name: LANDING_RELAY_COPY.step3TitleRelay,
      }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(LANDING_RELAY_COPY.step3ChipRelay).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Great meeting you, Sam").length).toBeGreaterThan(0);
    expect(screen.getAllByText("You met Sam Rivera").length).toBeGreaterThan(0);
    expect(screen.queryByText("New lead: Sam Rivera")).toBeNull();
    expect(screen.queryByText("Nice to meet you, Sam")).toBeNull();

    const relayButton = screen.getByRole("button", { name: "Relay (default)" });
    expect(relayButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("switches to direct view and shows Coming soon badge when enabled", () => {
    render(<HowItWorksSection />);

    fireEvent.click(screen.getAllByRole("button", { name: "Direct" })[0]!);

    expect(
      screen.getAllByRole("heading", {
        level: 3,
        name: LANDING_RELAY_COPY.step3TitleDirect,
      }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(LANDING_RELAY_COPY.comingSoonBadge).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(LANDING_RELAY_COPY.directStateLine).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(LANDING_RELAY_COPY.step3ChipRelay)).toBeNull();
    expect(screen.getAllByText("Sam's inbox").length).toBeGreaterThan(0);
  });
});
