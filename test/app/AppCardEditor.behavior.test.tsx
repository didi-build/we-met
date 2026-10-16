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

import { AppApiProvider } from "@/app-api/AppApiProvider";
import { createStubApi, emptyEditorCard } from "@/app-api/stub-api";
import { AppCardEditor } from "@/components/app/AppCardEditor";
import { AppThemeProvider } from "@/components/app/AppThemeProvider";
import type { EditorCard } from "@/app-api/types";
import { AppTestShell, setupAppEditorDom } from "./harness";
import { useEffect, useMemo, useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

setupAppEditorDom();

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function AuthedEditor({ search, draft }: { search: string; draft: EditorCard }) {
  const api = useMemo(() => createStubApi(search), [search]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void api.signIn().then(() => setReady(true));
  }, [api]);
  if (!ready) {
    return null;
  }
  return (
    <AppApiProvider api={api}>
      <AppThemeProvider>
        <AppCardEditor
          session={{ email: "ada@example.com", name: "Ada", allowed: true }}
          initialDraft={draft}
          initialPublished={null}
          onSessionRestored={() => {}}
          onSignIn={async () => {
            await api.signIn();
          }}
          signingIn={false}
        />
      </AppThemeProvider>
    </AppApiProvider>
  );
}

function renderEditor(search = "", draft = emptyEditorCard(), authed = false) {
  if (authed) {
    return render(<AuthedEditor search={search} draft={draft} />);
  }
  return render(
    <AppTestShell search={search}>
      <AppCardEditor
        session={{ email: "ada@example.com", name: "Ada", allowed: true }}
        initialDraft={draft}
        initialPublished={null}
        onSessionRestored={() => {}}
        onSignIn={async () => {}}
        signingIn={false}
      />
    </AppTestShell>,
  );
}

describe("AppCardEditor behavior", () => {
  it("shows placeholder greeting in preview when name is empty", () => {
    renderEditor();
    expect(screen.getByText("Your name here")).toBeTruthy();
  });

  it("preview shell is not inert (chips and About can receive clicks)", () => {
    renderEditor();
    const preview = screen.getByTestId("app-card-preview");
    expect(preview.hasAttribute("inert")).toBe(false);
    expect(preview.className).toContain("ap-card-preview-shell");
  });

  it("puts chip popover boundary on the preview scroll container", () => {
    renderEditor();
    const preview = screen.getByTestId("app-card-preview");
    const boundary = preview.closest("[data-chip-popover-boundary]");
    expect(boundary).toBeTruthy();
    expect(boundary).not.toBe(preview);
    expect((boundary as HTMLElement).style.overflow).toBe("auto");
  });

  it("debounces autosave and shows Saving then Saved", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderEditor();
    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: "Ada" } });
    await vi.advanceTimersByTimeAsync(900);
    await waitFor(() => expect(screen.getByText(/Saving/i)).toBeTruthy());
    await vi.advanceTimersByTimeAsync(700);
    await waitFor(() => expect(screen.getByText(/^Saved$/)).toBeTruthy());
  });

  it("publish gating lists what is missing", async () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /^Publish$/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/To publish, add your name and choose your link/),
      ).toBeTruthy();
    });
  });

  it("detects unpublished changes after publish", async () => {
    const draft = { ...emptyEditorCard(), name: "Ada Lovelace", slug: "ada-lovelace" };
    renderEditor("", draft, true);
    await waitFor(() => expect(screen.getByText(/Available/i)).toBeTruthy(), {
      timeout: 5000,
    });
    await waitFor(() => expect(screen.getByText(/^Saved$/)).toBeTruthy(), {
      timeout: 10_000,
    });
    fireEvent.click(screen.getByRole("button", { name: /^Publish$/i }));
    const confirmDialog = await waitFor(() => screen.getByRole("alertdialog"));
    fireEvent.click(within(confirmDialog).getByRole("button", { name: /^Publish$/i }));
    await waitFor(
      () => {
        expect(document.getElementById("pub-title")?.textContent).toMatch(
          /Your card is live/,
        );
      },
      { timeout: 10_000 },
    );
    const liveDialog = document
      .getElementById("pub-title")!
      .closest('[role="dialog"]')!;
    fireEvent.click(within(liveDialog as HTMLElement).getByLabelText(/^Close$/i));
    await waitFor(
      () => expect(screen.getByRole("button", { name: /Share card/i })).toBeTruthy(),
      { timeout: 10_000 },
    );
    fireEvent.change(screen.getByLabelText(/^Name$/i), {
      target: { value: "Ada L." },
    });
    await waitFor(
      () =>
        expect(screen.getByRole("button", { name: /Publish changes/i })).toBeTruthy(),
      { timeout: 5000 },
    );
  });

  it("returns focus to publish opener after closing published dialog", async () => {
    const draft = { ...emptyEditorCard(), name: "Ada Lovelace", slug: "ada-lovelace" };
    renderEditor("", draft, true);
    await waitFor(() => expect(screen.getByText(/Available/i)).toBeTruthy(), {
      timeout: 5000,
    });
    await waitFor(() => expect(screen.getByText(/^Saved$/)).toBeTruthy(), {
      timeout: 10_000,
    });
    const publishBtn = screen.getByRole("button", { name: /^Publish$/i });
    publishBtn.focus();
    fireEvent.click(publishBtn);
    const confirmDialog = await waitFor(() => screen.getByRole("alertdialog"));
    fireEvent.click(within(confirmDialog).getByRole("button", { name: /^Publish$/i }));
    await waitFor(
      () => {
        expect(document.getElementById("pub-title")?.textContent).toMatch(
          /Your card is live/,
        );
      },
      { timeout: 10_000 },
    );
    const liveDialog = document
      .getElementById("pub-title")!
      .closest('[role="dialog"]')!;
    fireEvent.click(within(liveDialog as HTMLElement).getByLabelText(/^Close$/i));
    expect(document.activeElement).toBe(publishBtn);
  });

  it("normalizes slug input to lowercase", () => {
    renderEditor();
    const slug = screen.getByLabelText(/Card address/i);
    fireEvent.change(slug, { target: { value: "Ada-Test" } });
    expect((slug as HTMLInputElement).value).toBe("ada-test");
  });
});
