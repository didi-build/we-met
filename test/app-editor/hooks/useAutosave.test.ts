// @vitest-environment jsdom

import type { AppApi } from "@/app-api/app-api";
import { AppApiError, type EditorCard } from "@/app-api/types";
import { useAutosave } from "@/lib/app-editor/hooks/useAutosave";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const BASE: EditorCard = {
  slug: "ada",
  name: "Ada",
  role: "",
  photo: "",
  about: [],
  services: [],
  links: { website: "", linkedin: "", github: "", instagram: "" },
  alternate: { url: "", label: "" },
};

function mockApi(saveDraft: AppApi["saveDraft"]): AppApi {
  return {
    getSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    getCard: vi.fn(),
    saveDraft,
    checkSlug: vi.fn(),
    uploadPhoto: vi.fn(),
    deletePhoto: vi.fn(),
    publish: vi.fn(),
  };
}

describe("useAutosave (unit)", () => {
  it("runs save after scheduleSave(0)", async () => {
    const saveDraft = vi.fn(async () => ({ updatedAt: new Date().toISOString() }));
    const onExpired = vi.fn();
    const { result } = renderHook(() =>
      useAutosave(mockApi(saveDraft), BASE, onExpired),
    );

    await act(async () => {
      result.current.scheduleSave(0);
    });

    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.saveUi).toBe("saved"));
  });

  it("calls onSessionExpired for unauthorized", async () => {
    const saveDraft = vi.fn(async () => {
      throw new AppApiError("unauthorized");
    });
    const onExpired = vi.fn();
    const { result } = renderHook(() =>
      useAutosave(mockApi(saveDraft), BASE, onExpired),
    );

    await act(async () => {
      result.current.scheduleSave(0);
    });

    await waitFor(() => expect(onExpired).toHaveBeenCalled());
    expect(result.current.saveUi).toBe("error");
  });

  it("saves the latest card after rapid changes", async () => {
    const saveDraft = vi.fn(async () => ({ updatedAt: new Date().toISOString() }));
    const onExpired = vi.fn();
    let card = BASE;
    const { result, rerender } = renderHook(
      ({ c }) => useAutosave(mockApi(saveDraft), c, onExpired),
      { initialProps: { c: card } },
    );

    card = { ...card, name: "Ada Lovelace" };
    rerender({ c: card });
    card = { ...card, role: "Mathematician" };
    rerender({ c: card });

    await act(async () => {
      result.current.scheduleSave(0);
    });

    await waitFor(() =>
      expect(saveDraft).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Ada Lovelace", role: "Mathematician" }),
      ),
    );
  });

  it("persists an edit made immediately after a photo upload save", async () => {
    const saveDraft = vi.fn(async () => ({ updatedAt: new Date().toISOString() }));
    const onExpired = vi.fn();
    let card: EditorCard = {
      ...BASE,
      photo: "/api/app/photo?v=" + "a".repeat(64),
    };
    const { result, rerender } = renderHook(
      ({ c }) => useAutosave(mockApi(saveDraft), c, onExpired),
      { initialProps: { c: card } },
    );

    card = { ...card, name: "After upload" };
    rerender({ c: card });

    await act(async () => {
      result.current.scheduleSave(0);
    });

    await waitFor(() =>
      expect(saveDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "After upload",
          photo: expect.stringContaining("/api/app/photo"),
        }),
      ),
    );
  });
});
