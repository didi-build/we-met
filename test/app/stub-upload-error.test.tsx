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

import { WeMetApp } from "@/components/app/WeMetApp";
import { AppTestShell, setupAppEditorDom } from "./harness";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

setupAppEditorDom();

beforeEach(() => {
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:test"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => cleanup());

describe("?stub=upload-error", () => {
  it("shows photo upload error after crop", async () => {
    render(
      <AppTestShell search="?stub=upload-error">
        <WeMetApp />
      </AppTestShell>,
    );
    await waitFor(() => expect(screen.getByText("Make your We Met card")).toBeTruthy());
    fireEvent.click(screen.getByText(/Sign in with Google/i).closest("button")!);
    await waitFor(
      () => expect(screen.getByRole("heading", { name: /your card/i })).toBeTruthy(),
      { timeout: 10_000 },
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
    await waitFor(
      () => expect(screen.getByText(/upload didn't finish/i)).toBeTruthy(),
      { timeout: 12_000 },
    );
  });
});
