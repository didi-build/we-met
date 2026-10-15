// @vitest-environment jsdom

import { HiCardPresentation } from "@/components/hi/HiCardPresentation";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { previewCardShell } from "@/lib/app-editor/preview-card-shell";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());

describe("HiCardPresentation greetingOverride", () => {
  it("uses greetingOverride instead of cardGreeting", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })),
    );
    const card = {
      ...previewCardShell("preview", ""),
      role: undefined,
    };
    render(
      <ThemeProvider>
        <HiCardPresentation
          card={card}
          photoUrl={null}
          plan="free"
          preview
          interactive
          greetingOverride="Your name here"
        />
      </ThemeProvider>,
    );
    expect(screen.getByText("Your name here")).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
