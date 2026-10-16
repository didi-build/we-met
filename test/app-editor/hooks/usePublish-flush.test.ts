// @vitest-environment jsdom

import type { AppApi } from "@/app-api/app-api";
import { emptyEditorCard } from "@/app-api/stub-api";
import { usePublish } from "@/lib/app-editor/hooks/usePublish";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function mockApi(): AppApi {
  return {
    getSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    getCard: vi.fn(),
    saveDraft: vi.fn(),
    checkSlug: vi.fn(),
    uploadPhoto: vi.fn(),
    deletePhoto: vi.fn(),
    publish: vi.fn(async () => ({ url: "https://we-met.link/hi/ada" })),
  };
}

describe("usePublish flushSave (unit)", () => {
  it("does not publish when flushSave reports failure", async () => {
    const api = mockApi();
    const card = { ...emptyEditorCard(), name: "Ada", slug: "ada" };
    const flushSave = vi.fn(async () => false);
    const onSuccess = vi.fn();
    const onBlocked = vi.fn();

    const { result } = renderHook(() =>
      usePublish(api, card, null, () => [], flushSave),
    );

    await act(async () => {
      await result.current.handlePublish(onSuccess, onBlocked);
    });

    expect(flushSave).toHaveBeenCalled();
    expect(api.publish).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onBlocked).not.toHaveBeenCalled();
  });
});
