// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { act, render } from "@testing-library/react";
import { HOW_IT_WORKS_INTERSECTION_OPTIONS } from "@/components/landing/how-it-works-observer";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";

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
    vi.unstubAllGlobals();
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
});
