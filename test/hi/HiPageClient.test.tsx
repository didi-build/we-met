// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HiPageClient } from "@/components/hi/HiPageClient";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { WE_MET_CARD_HOME_URL } from "@/lib/hi-card/card-content";
import { exampleCardInput } from "../helpers/example-card";
import type { CardRecord } from "@/card-data/types";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => null,
}));

vi.mock("@/components/hi/hi-sheet-motion", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/components/hi/hi-sheet-motion")>();
  return {
    ...mod,
    prefersReducedMotion: () => true,
    runSheetCloseAnimation: ({ onComplete }: { onComplete: () => void }) => {
      onComplete();
      return () => {};
    },
  };
});

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
  const files = ["mono.light.css", "mono.dark.css"];
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
  document.documentElement.setAttribute("data-palette", "mono");
});

afterEach(() => {
  cleanup();
});

function renderCard(overrides: Partial<CardRecord> = {}, plan = "free" as const) {
  const input = exampleCardInput();
  const card: CardRecord = {
    id: "test-id",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
    ...overrides,
  };
  return render(
    <ThemeProvider>
      <HiPageClient card={card} photoUrl={null} plan={plan} />
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
      services: undefined,
      links: undefined,
      alternate: undefined,
    });
    expect(screen.queryByText("About me")).toBeNull();
    expect(screen.queryByText("What I do")).toBeNull();
  });

  it("shows initials when there is no photo", () => {
    renderCard({ photoKey: null });
    expect(screen.getAllByText("DS").length).toBeGreaterThan(0);
  });

  it("links the free-plan banner to we-met.link", () => {
    renderCard({}, "free");
    const banners = screen.getAllByRole("link", { name: /Get your own card/i });
    for (const link of banners) {
      expect(link.getAttribute("href")).toBe(WE_MET_CARD_HOME_URL);
    }
  });

  it("does not override document dark theme with a nested data-theme", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.setAttribute("data-palette", "mono");
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

  it("restores focus to the sticky exchange opener without scrolling when the sheet closes", () => {
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        if (
          this.getAttribute("aria-label")?.includes("Exchange") ||
          (this instanceof HTMLElement && this.className.includes("-mt-1"))
        ) {
          return {
            top: -100,
            left: 0,
            right: 0,
            bottom: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          } as DOMRect;
        }
        return {
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });

    renderCard();
    fireEvent.scroll(window);

    const stickyExchange = screen.getByRole("button", { name: /^Exchange$/i });
    const focusSpy = vi.spyOn(stickyExchange, "focus");

    fireEvent.click(stickyExchange);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    expect(focusSpy).toHaveBeenCalled();
    expect(focusSpy.mock.calls.at(-1)?.[0]).toEqual({ preventScroll: true });

    rectSpy.mockRestore();
  });

  it.each([["light"], ["dark"]] as const)("renders in %s theme", (theme) => {
    document.documentElement.setAttribute("data-palette", "mono");
    document.documentElement.setAttribute("data-theme", theme);
    renderCard();
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg")
      .trim();
    expect(bg.length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Exchange contact/i })).toBeTruthy();
  });
});
