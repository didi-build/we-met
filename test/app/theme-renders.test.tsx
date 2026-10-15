// @vitest-environment jsdom

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

import { emptyEditorCard } from "@/app-api/stub-api";
import { AppCardEditor } from "@/components/app/AppCardEditor";
import { AppTestShell, setupAppEditorDom } from "./harness";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

setupAppEditorDom();

afterEach(() => cleanup());

describe("App editor theme renders", () => {
  it("renders in light theme", async () => {
    render(
      <AppTestShell theme="light">
        <AppCardEditor
          session={{ email: "a@b.com", name: "A", allowed: true }}
          initialDraft={emptyEditorCard()}
          initialPublished={null}
          onSessionRestored={() => {}}
          onSignIn={async () => {}}
          signingIn={false}
        />
      </AppTestShell>,
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /your card/i })).toBeTruthy(),
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("renders in dark theme", async () => {
    render(
      <AppTestShell theme="dark">
        <AppCardEditor
          session={{ email: "a@b.com", name: "A", allowed: true }}
          initialDraft={emptyEditorCard()}
          initialPublished={null}
          onSessionRestored={() => {}}
          onSignIn={async () => {}}
          signingIn={false}
        />
      </AppTestShell>,
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /your card/i })).toBeTruthy(),
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
