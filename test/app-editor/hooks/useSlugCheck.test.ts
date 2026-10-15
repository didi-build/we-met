// @vitest-environment jsdom

import type { AppApi } from "@/app-api/app-api";
import type { EditorCard } from "@/app-api/types";
import { useSlugCheck } from "@/lib/app-editor/hooks/useSlugCheck";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function mockApi(checkSlug: AppApi["checkSlug"]): AppApi {
  return {
    getSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    getCard: vi.fn(),
    saveDraft: vi.fn(),
    checkSlug,
    uploadPhoto: vi.fn(),
    publish: vi.fn(),
  };
}

const published: EditorCard = {
  slug: "didi",
  name: "",
  role: "",
  photo: "",
  about: [],
  services: [],
  links: {},
  alternate: { url: "", label: "" },
};

describe("useSlugCheck (unit)", () => {
  it("treats published slug as mine without API on mount", async () => {
    const checkSlug = vi.fn();
    const { result } = renderHook(() =>
      useSlugCheck(mockApi(checkSlug), published, "didi"),
    );

    await waitFor(() => expect(result.current.slugStatus.status).toBe("mine"));
    expect(checkSlug).not.toHaveBeenCalled();
  });

  it("ignores stale API responses when slug changes quickly", async () => {
    let resolveFirst: (() => void) | undefined;
    const checkSlug = vi.fn(async (slug: string) => {
      if (slug === "slow") {
        await new Promise<void>((r) => {
          resolveFirst = r;
        });
        return { status: "taken" as const };
      }
      return { status: "available" as const };
    });

    const { result } = renderHook(() => useSlugCheck(mockApi(checkSlug), null, ""));

    act(() => {
      result.current.onSlugInput("slow");
    });
    act(() => {
      result.current.onSlugInput("fast");
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 450));
    });

    await waitFor(() => expect(result.current.slugStatus.status).toBe("available"));
    expect(result.current.slugStatus).toMatchObject({ value: "fast" });

    resolveFirst?.();
  });
});
