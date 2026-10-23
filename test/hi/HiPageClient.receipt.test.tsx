// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HiPageClient } from "@/components/hi/HiPageClient";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { toHiPageCard } from "@/lib/hi-card/hi-page-card";
import {
  exchangeCompletedStorageKey,
  exchangeSessionStorageKey,
} from "@/lib/hi-card/exchange-session-storage";
import { exampleCardRecord } from "../helpers/example-card";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => null,
}));

function injectGeneratedPaletteCss() {
  if (document.getElementById("test-palette-tokens")) {
    return;
  }
  const dir = join(process.cwd(), "src/theme/tokens");
  const style = document.createElement("style");
  style.id = "test-palette-tokens";
  style.textContent = ["mono.light.css", "mono.dark.css"]
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  document.head.appendChild(style);
}

beforeAll(() => {
  injectGeneratedPaletteCss();
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

beforeEach(() => {
  stubMatchMedia();
  document.documentElement.setAttribute("data-theme", "light");
  document.documentElement.setAttribute("data-palette", "mono");
});

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  cleanup();
});

describe("HiPageClient visitor receipt (component)", () => {
  it("does not render owner email or phone before exchange", () => {
    const record = exampleCardRecord({
      email: "hidden-owner@example.com",
      contact: {
        ...exampleCardRecord().contact,
        phone: "+1 555 9999",
      },
    });
    const pageCard = toHiPageCard(record);
    render(
      <ThemeProvider>
        <HiPageClient card={pageCard} photoUrl={null} />
      </ThemeProvider>,
    );
    expect(screen.queryByText("hidden-owner@example.com")).toBeNull();
    expect(screen.queryByText(/555 9999/)).toBeNull();
    expect(screen.queryByText(/\+1 555 9999/)).toBeNull();
  });

  it("shows reload fallback when exchange completed without session", () => {
    const slug = exampleCardRecord().slug;
    window.localStorage.setItem(exchangeCompletedStorageKey(slug), "1");
    const pageCard = toHiPageCard(exampleCardRecord({ slug }));
    render(
      <ThemeProvider>
        <HiPageClient card={pageCard} photoUrl={null} />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: /Contact sent/i })).toBeTruthy();
    expect(
      screen.getByText(/has your details and will follow up by email/i),
    ).toBeTruthy();
  });

  it("shows receipt when session exists and never stores lead token in localStorage", () => {
    const slug = "receipt-slug";
    const token = "lead-token-abc";
    window.sessionStorage.setItem(
      exchangeSessionStorageKey(slug),
      JSON.stringify({ firstName: "Sam", leadToken: token }),
    );
    window.localStorage.setItem(exchangeCompletedStorageKey(slug), "1");

    const pageCard = toHiPageCard(exampleCardRecord({ slug }));
    render(
      <ThemeProvider>
        <HiPageClient card={pageCard} photoUrl={null} />
      </ThemeProvider>,
    );

    expect(screen.getByText(/Sent to/)).toBeTruthy();
    const form = screen
      .getByRole("button", { name: /Save .* contact/i })
      .closest("form");
    expect(form?.querySelector('input[name="token"]')?.getAttribute("value")).toBe(
      token,
    );

    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      const value = key ? window.localStorage.getItem(key) : "";
      expect(value).not.toContain(token);
    }
  });
});
