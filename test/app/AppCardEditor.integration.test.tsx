// @vitest-environment jsdom

import { AppApiProvider } from "@/app-api/AppApiProvider";
import { createStubApi, emptyEditorCard } from "@/app-api/stub-api";
import { AppCardEditor } from "@/components/app/AppCardEditor";
import { AppThemeProvider } from "@/components/app/AppThemeProvider";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
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

beforeAll(() => {
  const dir = join(process.cwd(), "src/theme/tokens");
  const style = document.createElement("style");
  style.id = "test-palette-tokens";
  style.textContent = ["mono.light.css", "mono.dark.css"]
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  document.head.appendChild(style);
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
  vi.unstubAllGlobals();
});

function Harness() {
  const api = useMemo(() => createStubApi(""), []);
  return (
    <AppApiProvider api={api}>
      <AppThemeProvider>
        <AppCardEditor
          session={{ email: "ada@example.com", name: "Ada", allowed: true }}
          initialDraft={emptyEditorCard()}
          initialPublished={null}
          onSessionRestored={() => {}}
          onSignIn={async () => {}}
          signingIn={false}
        />
      </AppThemeProvider>
    </AppApiProvider>
  );
}

describe("AppCardEditor (integration)", () => {
  it("renders editor with live preview without useTheme crash", async () => {
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /your card/i })).toBeTruthy();
    });
    expect(screen.getByTestId("app-card-preview-inert")).toBeTruthy();
    expect(screen.getByText(/exchange is off in the preview/i)).toBeTruthy();
  });
});
