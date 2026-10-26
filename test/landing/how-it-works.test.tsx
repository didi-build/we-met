// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HOW_IT_WORKS_INTERSECTION_OPTIONS } from "@/components/landing/how-it-works-observer";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { LANDING_RELAY_COPY } from "@/lib/landing/landing-relay-mode";

describe("HowItWorksSection (unit)", () => {
  let observerCallback: IntersectionObserverCallback | null = null;
  let observeMock: ReturnType<typeof vi.fn>;
  let disconnectMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    observerCallback = null;
    observeMock = vi.fn();
    disconnectMock = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn(function IntersectionObserverMock(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        observerCallback = callback;
        expect(options).toEqual(HOW_IT_WORKS_INTERSECTION_OPTIONS);
        return {
          observe: observeMock,
          disconnect: disconnectMock,
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

    expect(screen.getAllByText(LANDING_RELAY_COPY.replyNote).length).toBeGreaterThan(0);
    expect(screen.queryByText(/save you in one tap/i)).toBeNull();
    expect(screen.queryByText(/contact card goes with it/i)).toBeNull();
  });

  it("matches the DIDI-823 design reference reply note (we-met#101)", () => {
    const approvedReplyNote =
      "To send it on, just hit Reply. When you hit Reply, they can save your contact card.";
    expect(LANDING_RELAY_COPY.replyNote).toBe(approvedReplyNote);

    try {
      execSync("git fetch origin design/DIDI-823-landing-copy --depth=1", {
        stdio: "ignore",
      });
    } catch {
      // Ref may already exist locally.
    }
    const referenceHtml = execSync(
      "git show origin/design/DIDI-823-landing-copy:design/landing/index.html",
      { encoding: "utf8" },
    );
    expect(referenceHtml).toContain(approvedReplyNote);
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

  it("keeps focus on the mode switch after toggling direct and relay", () => {
    render(<HowItWorksSection />);

    const directButtons = screen.getAllByRole("button", { name: "Direct" });
    const direct = directButtons[0]!;
    direct.focus();
    fireEvent.click(direct);

    expect(document.activeElement).toBe(direct);
    expect(direct.getAttribute("aria-pressed")).toBe("true");

    const relayButtons = screen.getAllByRole("button", { name: "Relay (default)" });
    const relay = relayButtons[0]!;
    relay.focus();
    fireEvent.click(relay);

    expect(document.activeElement).toBe(relay);
    expect(relay.getAttribute("aria-pressed")).toBe("true");
  });

  it("disconnects and re-subscribes the scroll observer when the mode toggle changes", () => {
    render(<HowItWorksSection />);
    expect(observeMock.mock.calls.length).toBeGreaterThan(0);
    const observesAfterMount = observeMock.mock.calls.length;
    expect(disconnectMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: "Direct" })[0]!);
    expect(disconnectMock).toHaveBeenCalled();
    expect(observeMock.mock.calls.length).toBeGreaterThan(observesAfterMount);

    const step3 = document.querySelectorAll(".lp-step")[2]!;
    act(() => {
      observerCallback?.(
        [
          {
            isIntersecting: true,
            target: step3,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });

    expect(step3.getAttribute("data-active")).toBe("true");
    expect(
      document.querySelector('[data-layer="2"]')?.getAttribute("data-active"),
    ).toBe("true");
  });
});
