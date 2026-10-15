// @vitest-environment jsdom

import { AppApiProvider } from "@/app-api/AppApiProvider";
import { createStubApi } from "@/app-api/stub-api";
import { AppThemeProvider } from "@/components/app/AppThemeProvider";
import { WeMetApp } from "@/components/app/WeMetApp";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useMemo } from "react";
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

function injectPaletteCss() {
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
  injectPaletteCss();
});

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("900px"),
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

function TestApp({ search = "" }: { search?: string }) {
  const api = useMemo(() => createStubApi(search), [search]);
  return (
    <AppApiProvider api={api}>
      <AppThemeProvider>
        <WeMetApp />
      </AppThemeProvider>
    </AppApiProvider>
  );
}

function renderApp(search = "") {
  return render(<TestApp search={search} />);
}

async function waitForBoot() {
  await waitFor(
    () => {
      expect(screen.getByText("Make your We Met card")).toBeTruthy();
    },
    { timeout: 3000 },
  );
}

function clickGoogleSignIn() {
  fireEvent.click(screen.getByText(/Sign in with Google/i).closest("button")!);
}

describe("WeMetApp editor (integration)", () => {
  it("renders the full editor after stub sign-in without theme crash", async () => {
    renderApp();
    await waitForBoot();
    clickGoogleSignIn();
    await waitFor(
      () => {
        expect(screen.getByRole("heading", { name: /your card/i })).toBeTruthy();
      },
      { timeout: 8000 },
    );
    expect(screen.getByTestId("app-card-preview-inert")).toBeTruthy();
    expect(screen.queryByText(/useTheme must be used/i)).toBeNull();
  });

  it("shows login error with ?stub=login-error", async () => {
    renderApp("?stub=login-error");
    await waitForBoot();
    clickGoogleSignIn();
    await waitFor(
      () => {
        expect(screen.getByRole("alert").textContent).toMatch(/sign-in didn't finish/i);
      },
      { timeout: 8000 },
    );
  });

  it("shows closed signup with ?stub=closed", async () => {
    renderApp("?stub=closed");
    await waitForBoot();
    clickGoogleSignIn();
    await waitFor(
      () => {
        expect(screen.getByRole("heading", { name: /sign-up/i })).toBeTruthy();
      },
      { timeout: 8000 },
    );
  });
});
