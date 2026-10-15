// @vitest-environment jsdom

import { HiPageClient } from "@/components/hi/HiPageClient";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { WE_MET_CARD_HOME_URL } from "@/lib/hi-card/card-content";
import { exampleCardInput } from "../helpers/example-card";
import type { CardRecord } from "@/card-data/types";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function stubMatchMedia() {
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
}

beforeEach(() => {
  stubMatchMedia();
  document.documentElement.setAttribute("data-theme", "light");
  document.documentElement.setAttribute("data-palette", "green");
});

afterEach(() => {
  cleanup();
});

function renderCard(overrides: Partial<CardRecord> = {}) {
  const input = exampleCardInput();
  const card: CardRecord = {
    id: "test-id",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
    ...overrides,
  };
  return render(
    <ThemeProvider>
      <HiPageClient card={card} photoUrl={null} />
    </ThemeProvider>,
  );
}

describe("HiPageClient (component)", () => {
  it("renders a full card from example data", () => {
    renderCard();
    expect(screen.getByText(/I'm Didi/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Exchange contact/i })).toBeTruthy();
    expect(screen.getByText("About me")).toBeTruthy();
  });

  it("renders without optional sections", () => {
    renderCard({
      about: undefined,
      aboutTitle: undefined,
      services: undefined,
      servicesTitle: undefined,
      publicLinks: [],
      fallbackUrl: undefined,
      fallbackLabel: undefined,
    });
    expect(screen.queryByText("About me")).toBeNull();
    expect(screen.queryByText("What I do")).toBeNull();
  });

  it("shows initials when there is no photo", () => {
    renderCard({ photoKey: null });
    expect(screen.getAllByText("DS").length).toBeGreaterThan(0);
  });

  it("links the free-plan banner to we-met.link", () => {
    renderCard({ plan: "free" });
    const banners = screen.getAllByRole("link", { name: /Get your own card/i });
    for (const link of banners) {
      expect(link.getAttribute("href")).toBe(WE_MET_CARD_HOME_URL);
    }
  });
});
