import type { AppApi } from "@/app-api/app-api";
import { createHttpAuthApi } from "@/app-api/http-auth";
import {
  AppApiError,
  type AppCardBundle,
  type EditorCard,
  type SlugCheckResult,
} from "@/app-api/types";

async function readApiError(response: Response): Promise<AppApiError> {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; fields?: Record<string, string> };
    };
    const code = body.error?.code;
    if (code === "unauthorized") {
      return new AppApiError("unauthorized");
    }
    if (code === "forbidden") {
      return new AppApiError("forbidden");
    }
    if (code === "rate-limited") {
      return new AppApiError("rate-limited");
    }
    if (code === "slug-taken") {
      return new AppApiError("slug-taken");
    }
    if (code === "slug-locked") {
      return new AppApiError("slug-locked");
    }
    if (code === "slug-reserved") {
      return new AppApiError("slug-reserved");
    }
    if (code === "slug-invalid") {
      return new AppApiError("slug-invalid");
    }
    if (code === "name-missing") {
      return new AppApiError("name-missing");
    }
    if (code === "invalid-fields") {
      return new AppApiError("invalid-fields", undefined, body.error?.fields);
    }
  } catch {
    // fall through
  }
  return new AppApiError("network");
}

function mutationHeaders(contentType: string): HeadersInit {
  return {
    "content-type": contentType,
  };
}

export function createHttpApi(): AppApi {
  const auth = createHttpAuthApi();

  return {
    ...auth,

    async getCard(): Promise<AppCardBundle> {
      const response = await fetch("/api/app/card", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 401) {
        throw new AppApiError("unauthorized");
      }
      if (response.status === 403) {
        throw new AppApiError("forbidden");
      }
      if (!response.ok) {
        throw await readApiError(response);
      }
      return (await response.json()) as AppCardBundle;
    },

    async saveDraft(card: EditorCard): Promise<{ updatedAt: string }> {
      const response = await fetch("/api/app/card/draft", {
        method: "PUT",
        credentials: "same-origin",
        headers: mutationHeaders("application/json"),
        body: JSON.stringify({ card }),
      });
      if (response.status === 401) {
        throw new AppApiError("unauthorized");
      }
      if (response.status === 403) {
        throw new AppApiError("forbidden");
      }
      if (response.status === 429) {
        throw new AppApiError("rate-limited");
      }
      if (!response.ok) {
        throw await readApiError(response);
      }
      return (await response.json()) as { updatedAt: string };
    },

    async checkSlug(slug: string): Promise<SlugCheckResult> {
      const response = await fetch(
        `/api/app/slug-check?slug=${encodeURIComponent(slug)}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        },
      );
      if (!response.ok) {
        throw new AppApiError("network");
      }
      return (await response.json()) as SlugCheckResult;
    },

    async uploadPhoto(blob: Blob): Promise<{ url: string }> {
      const response = await fetch("/api/app/photo", {
        method: "POST",
        credentials: "same-origin",
        headers: mutationHeaders("image/jpeg"),
        body: blob,
      });
      if (response.status === 401) {
        throw new AppApiError("unauthorized");
      }
      if (response.status === 403) {
        throw new AppApiError("forbidden");
      }
      if (response.status === 429) {
        throw new AppApiError("rate-limited");
      }
      if (!response.ok) {
        throw new AppApiError("network");
      }
      return (await response.json()) as { url: string };
    },

    async publish(card: EditorCard): Promise<{ url: string }> {
      const response = await fetch("/api/app/card/publish", {
        method: "POST",
        credentials: "same-origin",
        headers: mutationHeaders("application/json"),
        body: JSON.stringify({ card }),
      });
      if (response.status === 401) {
        throw new AppApiError("unauthorized");
      }
      if (response.status === 403) {
        throw new AppApiError("forbidden");
      }
      if (response.status === 429) {
        throw new AppApiError("rate-limited");
      }
      if (!response.ok) {
        throw await readApiError(response);
      }
      return (await response.json()) as { url: string };
    },
  };
}
