// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LANDING_RELAY_COPY } from "@/lib/landing/landing-relay-mode";

vi.mock("@/lib/landing/landing-relay-mode", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/landing/landing-relay-mode")>();
  return { ...actual, SHOW_DIRECT_COMING_SOON: false };
});

import { HowItWorksSection } from "@/components/landing/HowItWorksSection";

describe("HowItWorksSection direct badge flag (unit)", () => {
  afterEach(() => {
    cleanup();
  });

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
  });

  it("hides Coming soon badge when SHOW_DIRECT_COMING_SOON is false", () => {
    render(<HowItWorksSection />);
    fireEvent.click(screen.getAllByRole("button", { name: "Direct" })[0]!);

    expect(screen.queryByText(LANDING_RELAY_COPY.comingSoonBadge)).toBeNull();
    expect(document.querySelector('[data-slot="direct-coming-soon"]')).toBeNull();
    expect(document.querySelector(".lp-chip-slot")).toBeTruthy();
  });
});
