// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HiPageClient } from "@/components/hi/HiPageClient";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { previewCardShell } from "@/lib/app-editor/preview-card-shell";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => null,
}));

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

beforeEach(() => {
  stubMatchMedia();
  document.documentElement.setAttribute("data-theme", "light");
  document.documentElement.setAttribute("data-palette", "mono");
});

afterEach(() => {
  cleanup();
});

describe("HiPageClient preview", () => {
  it("shows placeholder name when preview and name is empty", () => {
    const card = {
      ...previewCardShell("preview", ""),
      role: undefined,
    };
    render(
      <ThemeProvider>
        <HiPageClient card={card} photoUrl={null} preview />
      </ThemeProvider>,
    );
    expect(screen.getByText("Your name here")).toBeTruthy();
  });
});
