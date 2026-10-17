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

import { WeMetApp } from "@/components/app/WeMetApp";
import { AppTestShell, setupAppEditorDom } from "./harness";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

setupAppEditorDom();

afterEach(() => cleanup());

function renderApp(search = "") {
  return render(
    <AppTestShell search={search}>
      <WeMetApp />
    </AppTestShell>,
  );
}

async function bootAndSignIn(search = "") {
  renderApp(search);
  await waitFor(() => expect(screen.getByText("Make your We Met card")).toBeTruthy());
  fireEvent.click(screen.getByText(/Sign in with Google/i).closest("button")!);
  await waitFor(
    () => {
      expect(screen.getByRole("heading", { name: /your card/i })).toBeTruthy();
    },
    { timeout: 10_000 },
  );
}

describe("WeMetApp stub failure flags", () => {
  it("?stub=slug-taken blocks publish for taken slug", async () => {
    const { AppCardEditor } = await import("@/components/app/AppCardEditor");
    const { emptyEditorCard } = await import("@/app-api/stub-api");
    const draft = { ...emptyEditorCard(), name: "Ada Lovelace", slug: "ada-test" };
    render(
      <AppTestShell search="?stub=slug-taken">
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
    await waitFor(() => expect(screen.getByText(/^Saved$/)).toBeTruthy(), {
      timeout: 10_000,
    });
    const slugInput = screen.getByLabelText(/Card address/i);
    fireEvent.change(slugInput, { target: { value: "sam" } });
    await waitFor(() => expect(screen.getByText(/That link is taken/i)).toBeTruthy(), {
      timeout: 5000,
    });
    fireEvent.click(screen.getByRole("button", { name: /^Publish$/i }));
    await waitFor(() => {
      expect(screen.getByText(/choose a link that works/i)).toBeTruthy();
    });
  });

  it("?stub=save-error shows Retry after failed autosave", async () => {
    await bootAndSignIn("?stub=save-error");
    const nameInput = screen.getByLabelText(/Display name/i);
    fireEvent.change(nameInput, { target: { value: "Ada Lovelace" } });
    await waitFor(
      () => {
        expect(screen.getByText(/Couldn't save/i)).toBeTruthy();
      },
      { timeout: 10_000 },
    );
    expect(screen.getByRole("button", { name: /Retry/i })).toBeTruthy();
  });

  it("?stub=session-expired opens session dialog", async () => {
    await bootAndSignIn("?stub=session-expired");
    const nameInput = screen.getByLabelText(/Display name/i);
    fireEvent.change(nameInput, { target: { value: "Ada" } });
    await waitFor(
      () => {
        expect(screen.getByRole("alertdialog")).toBeTruthy();
      },
      { timeout: 10_000 },
    );
    expect(screen.getByText(/Sign in again to keep editing/i)).toBeTruthy();
  });
});
