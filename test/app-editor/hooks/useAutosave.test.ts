// @vitest-environment jsdom

import type { AppApi } from "@/app-api/app-api";
import { AppApiError, type EditorCard } from "@/app-api/types";
import { useAutosave } from "@/lib/app-editor/hooks/useAutosave";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const CARD: EditorCard = {
  slug: "ada",
  name: "Ada",
  role: "",
  photo: "",
  about: [],
  services: [],
  links: {},
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
    publish: vi.fn(),
  };
}

describe("useAutosave (unit)", () => {
  it("runs save after scheduleSave(0)", async () => {
    const saveDraft = vi.fn(async () => ({ updatedAt: new Date().toISOString() }));
    const onExpired = vi.fn();
    const { result } = renderHook(() =>
      useAutosave(mockApi(saveDraft), CARD, onExpired),
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
      useAutosave(mockApi(saveDraft), CARD, onExpired),
    );

    await act(async () => {
      result.current.scheduleSave(0);
    });

    await waitFor(() => expect(onExpired).toHaveBeenCalled());
    expect(result.current.saveUi).toBe("error");
  });
});
