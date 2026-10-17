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

vi.mock("@/lib/app-editor/photo-crop", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/app-editor/photo-crop")>();
  return {
    ...mod,
    renderCroppedPhotoJpeg: vi.fn(async () => new Blob([1, 2], { type: "image/jpeg" })),
  };
});

import { AppApiProvider } from "@/app-api/AppApiProvider";
import type { AppApi } from "@/app-api/app-api";
import { createStubApi, emptyEditorCard } from "@/app-api/stub-api";
import { AppCardEditor } from "@/components/app/AppCardEditor";
import { AppThemeProvider } from "@/components/app/AppThemeProvider";
import { AppTestShell, setupAppEditorDom } from "../app/harness";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

setupAppEditorDom();

const PHOTO_URL = `/api/app/photo?v=${"a".repeat(64)}`;

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:test"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AppCardEditor photo upload merge (integration)", () => {
  it("keeps name edits made while uploadPhoto is in flight", async () => {
    let finishUpload: ((value: { url: string }) => void) | undefined;
    const stub = createStubApi("");
    const uploadPhoto = vi.fn(
      () =>
        new Promise<{ url: string }>((resolve) => {
          finishUpload = resolve;
        }),
    );
    const api: AppApi = { ...stub, uploadPhoto };

    render(
      <AppTestShell search="">
        <AppApiProvider api={api}>
          <AppThemeProvider>
            <AppCardEditor
              session={{ email: "ada@example.com", name: "Ada", allowed: true }}
              initialDraft={emptyEditorCard()}
              initialPublished={null}
              onSessionRestored={() => {}}
              onSignIn={async () => {
                await api.signIn();
              }}
              signingIn={false}
            />
          </AppThemeProvider>
        </AppApiProvider>
      </AppTestShell>,
    );

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /your card/i })).toBeTruthy(),
    );

    const file = new File([new Uint8Array([1, 2, 3])], "photo.jpg", {
      type: "image/jpeg",
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/Crop your photo/i)).toBeTruthy());

    let img: HTMLImageElement | null = null;
    await waitFor(() => {
      img = document.querySelector(".ap-crop img");
      expect(img).toBeTruthy();
    });
    Object.defineProperty(img!, "naturalWidth", { value: 400 });
    Object.defineProperty(img!, "naturalHeight", { value: 400 });
    fireEvent.load(img!);
    fireEvent.click(screen.getByRole("button", { name: /Use photo/i }));

    await waitFor(() => expect(uploadPhoto).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/Display name/i), {
      target: { value: "Edited during upload" },
    });

    finishUpload?.({ url: PHOTO_URL });

    await waitFor(() => {
      expect((screen.getByLabelText(/Display name/i) as HTMLInputElement).value).toBe(
        "Edited during upload",
      );
      const previewImg = document.querySelector(
        ".ap-card-preview-shell img",
      ) as HTMLImageElement | null;
      expect(previewImg?.getAttribute("src")).toContain(PHOTO_URL);
    });
  });
});
