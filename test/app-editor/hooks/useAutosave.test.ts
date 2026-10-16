// @vitest-environment jsdom

import type { AppApi } from "@/app-api/app-api";
import { AppApiError, type EditorCard } from "@/app-api/types";
import { useAutosave } from "@/lib/app-editor/hooks/useAutosave";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves the card that was current when the debounce timer fires", async () => {
    vi.useFakeTimers();
    const saveDraft = vi.fn(async () => ({ updatedAt: new Date().toISOString() }));
    const onExpired = vi.fn();
    const cardA = { ...BASE, name: "Card A" };
    const cardB = { ...BASE, name: "Card B" };

    const { result, rerender } = renderHook(
      ({ c }) => useAutosave(mockApi(saveDraft), c, onExpired),
      { initialProps: { c: cardA } },
    );

    act(() => {
      result.current.scheduleSave(800);
    });

    rerender({ c: cardB });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ name: "Card B" }));
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

  it("flushSave returns false when save fails", async () => {
    const saveDraft = vi.fn(async () => {
      throw new AppApiError("unavailable");
    });
    const onExpired = vi.fn();
    const { result } = renderHook(() =>
      useAutosave(mockApi(saveDraft), BASE, onExpired),
    );

    let ok = true;
    await act(async () => {
      ok = await result.current.flushSave();
    });

    expect(ok).toBe(false);
    expect(result.current.saveUi).toBe("error");
  });

  it("flushSave returns true when save succeeds", async () => {
    const saveDraft = vi.fn(async () => ({ updatedAt: new Date().toISOString() }));
    const onExpired = vi.fn();
    const { result } = renderHook(() =>
      useAutosave(mockApi(saveDraft), BASE, onExpired),
    );

    let ok = false;
    await act(async () => {
      ok = await result.current.flushSave();
    });

    expect(ok).toBe(true);
    expect(result.current.saveUi).toBe("saved");
  });
});
