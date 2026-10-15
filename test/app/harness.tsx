// @vitest-environment jsdom

import { AppApiProvider } from "@/app-api/AppApiProvider";
import { createStubApi } from "@/app-api/stub-api";
import { AppThemeProvider } from "@/components/app/AppThemeProvider";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useMemo } from "react";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";

export function injectPaletteCss() {
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

export function setupAppEditorDom() {
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
    vi.unstubAllGlobals();
  });
}

export function AppTestShell({
  search = "",
  theme = "light" as "light" | "dark",
  children,
}: {
  search?: string;
  theme?: "light" | "dark";
  children: React.ReactNode;
}) {
  const api = useMemo(() => createStubApi(search), [search]);
  document.documentElement.setAttribute("data-theme", theme);
  return (
    <AppApiProvider api={api}>
      <AppThemeProvider>{children}</AppThemeProvider>
    </AppApiProvider>
  );
}
