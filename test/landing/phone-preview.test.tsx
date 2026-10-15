// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LandingPhonePreview } from "@/components/landing/LandingPhonePreview";
import {
  LANDING_PHONE_AVATAR_TOP_INSET_PX,
  LANDING_PHONE_AVATAR_TOP_INSET_SCALED_PX,
} from "@/lib/landing/landing-phone-layout";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
  document.documentElement.setAttribute("data-theme", "light");
  document.documentElement.setAttribute("data-palette", "mono");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LandingPhonePreview (unit)", () => {
  it("uses design pro top margin so the avatar clears the phone screen (L3/L4)", () => {
    const { container } = render(
      <ThemeProvider>
        <LandingPhonePreview />
      </ThemeProvider>,
    );
    const cardSection = container.querySelector(
      "section.relative.w-full.rounded-\\[24px\\]",
    );
    expect(cardSection?.className).toMatch(/mt-\[84px\]/);
    expect(LANDING_PHONE_AVATAR_TOP_INSET_PX).toBeGreaterThan(0);
    expect(LANDING_PHONE_AVATAR_TOP_INSET_SCALED_PX).toBeCloseTo(24.6176, 3);
  });

  it("renders live card presentation without iframe and is aria-hidden", () => {
    const { container } = render(
      <ThemeProvider>
        <LandingPhonePreview />
      </ThemeProvider>,
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector(".lp-phone")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(container.querySelector(".hi-card-page")).toBeTruthy();
    expect(container.querySelector("img[alt='Didi Shoukralla']")).toBeTruthy();
    expect(container.querySelector(".lp-fb")).toBeNull();
  });

  it("uses non-interactive phone screen (pointer-events none in CSS)", () => {
    const css = readFileSync("src/components/landing/landing.css", "utf8");
    expect(css).toMatch(/\.lp-phone-screen[\s\S]*?pointer-events:\s*none/);
    expect(css).toMatch(/\.lp-phone-content[\s\S]*?overflow:\s*hidden/);
  });

  it("preview module does not import exchange client or Turnstile", () => {
    const previewSrc = readFileSync(
      "src/components/landing/LandingPhonePreview.tsx",
      "utf8",
    );
    const presentationSrc = readFileSync(
      "src/components/hi/HiCardPresentation.tsx",
      "utf8",
    );
    const fixtureSrc = readFileSync(
      "src/lib/landing/landing-card-preview-fixture.ts",
      "utf8",
    );
    const combined = `${previewSrc}\n${presentationSrc}\n${fixtureSrc}`;
    expect(combined).not.toMatch(/hi-exchange-api/);
    expect(combined).not.toMatch(/react-turnstile/);
    expect(combined).not.toMatch(/HiExchangeSheet/);
    expect(fixtureSrc).not.toMatch(/design\/card/);
  });

  it("clicking controls does not fetch or navigate", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign: assignMock, href: "http://localhost/" },
      writable: true,
    });

    const { container } = render(
      <ThemeProvider>
        <LandingPhonePreview />
      </ThemeProvider>,
    );

    const clickables = container.querySelectorAll(
      "button, a, [role='switch'], [data-hi-chip-btn]",
    );
    expect(clickables.length).toBeGreaterThan(0);
    clickables.forEach((el) => {
      fireEvent.click(el);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
  });
});
