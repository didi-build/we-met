// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HiPageClient } from "@/components/hi/HiPageClient";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { WE_MET_CARD_HOME_URL } from "@/lib/hi-card/card-content";
import { exampleCardInput } from "../helpers/example-card";
import type { CardRecord } from "@/card-data/types";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

function injectGeneratedPaletteCss() {
  if (document.getElementById("test-palette-tokens")) {
    return;
  }
  const dir = join(process.cwd(), "src/theme/tokens");
  const files = [
    "mono.light.css",
    "mono.dark.css",
    "green.light.css",
    "green.dark.css",
    "blue.light.css",
    "blue.dark.css",
  ];
  const style = document.createElement("style");
  style.id = "test-palette-tokens";
  style.textContent = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
  document.head.appendChild(style);
}

beforeAll(() => {
  injectGeneratedPaletteCss();
});

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
      fallbackLabel: undefined,
    });
    expect(screen.queryByText("About me")).toBeNull();
    expect(screen.queryByText("What I do")).toBeNull();
  });

  it("shows initials when there is no photo", () => {
    renderCard({ photoKey: null });
    expect(screen.getAllByText("DS").length).toBeGreaterThan(0);
  });

  it("renders website globe with other social icon links", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "didi.build" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "LinkedIn" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "GitHub" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Instagram" })).toBeTruthy();
  });

  it("links the free-plan banner to we-met.link", () => {
    renderCard({ plan: "free" });
    const banners = screen.getAllByRole("link", { name: /Get your own card/i });
    for (const link of banners) {
      expect(link.getAttribute("href")).toBe(WE_MET_CARD_HOME_URL);
    }
  });

  it("does not override document dark theme with a nested data-theme", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.setAttribute("data-palette", "green");
    renderCard();
    expect(document.querySelector('[data-theme="light"]')).toBeNull();
    const rootSurface = getComputedStyle(document.documentElement)
      .getPropertyValue("--surface")
      .trim();
    const cardSurface = document.querySelector(".bg-surface");
    expect(cardSurface).toBeTruthy();
    expect(getComputedStyle(cardSurface!).getPropertyValue("--surface").trim()).toBe(
      rootSurface,
    );
  });

  it.each([
    ["mono", "light"],
    ["mono", "dark"],
    ["green", "light"],
    ["green", "dark"],
    ["blue", "light"],
    ["blue", "dark"],
  ] as const)("renders with palette %s in %s theme", (palette, theme) => {
    document.documentElement.setAttribute("data-palette", palette);
    document.documentElement.setAttribute("data-theme", theme);
    renderCard({ variant: palette === "blue" ? "green" : palette });
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg")
      .trim();
    expect(bg.length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Exchange contact/i })).toBeTruthy();
  });
});
