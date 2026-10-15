"use client";

import type { AppApi } from "@/app-api/app-api";
import type { EditorCard } from "@/app-api/types";
import { useCallback, useMemo, useState } from "react";

export function publishBlockers(input: {
  slugEditing: boolean;
  name: string;
  slug: string;
  slugStatus: string;
  fieldKeys: string[];
  fieldError: (key: string) => string;
}): string[] {
  const out: string[] = [];
  if (input.slugEditing) {
    out.push("tap the check to confirm your new link, or cancel");
  }
  if (!input.name.trim()) {
    out.push("add your name");
  }
  if (!input.slug) {
    out.push("choose your link");
  } else if (["invalid", "reserved", "taken"].includes(input.slugStatus)) {
    out.push("choose a link that works");
  } else if (input.slugStatus === "checking" || input.slugStatus === "typing") {
    out.push("wait for your link to be checked");
  }
  const others = input.fieldKeys.filter(
    (k) => k !== "slug" && k !== "name" && input.fieldError(k),
  );
  if (others.length || (input.name.trim() && input.fieldError("name"))) {
    out.push("fix the fields marked in red");
  }
  return out;
}

export function publishBlockerSentence(blockers: string[]): string {
  if (!blockers.length) {
    return "";
  }
  const s =
    blockers.length > 1
      ? `${blockers.slice(0, -1).join(", ")} and ${blockers[blockers.length - 1]}`
      : blockers[0];
  return `To publish, ${s}.`;
}

export function usePublish(
  api: AppApi,
  card: EditorCard,
  published: EditorCard | null,
  blockersFn: () => string[],
) {
  const [publishing, setPublishing] = useState(false);

  const dirty = useMemo(() => {
    if (!published) {
      return true;
    }
    return JSON.stringify(card) !== JSON.stringify(published);
  }, [card, published]);

  const publishState: "draft" | "changes" | "live" = !published
    ? "draft"
    : dirty
      ? "changes"
      : "live";

  const handlePublish = useCallback(
    async (onSuccess: (url: string) => void, onBlocked: (message: string) => void) => {
      const b = blockersFn();
      if (b.length) {
        onBlocked(publishBlockerSentence(b));
        return { blocked: true as const };
      }
      setPublishing(true);
      try {
        const result = await api.publish(card);
        onSuccess(result.url);
        return { blocked: false as const, published: true as const };
      } catch {
        onBlocked(
          "Something went wrong on our end and your card wasn't published. Your changes are saved. Try again?",
        );
        return { blocked: false as const, published: false as const };
      } finally {
        setPublishing(false);
      }
    },
    [api, blockersFn, card],
  );

  return { publishing, dirty, publishState, handlePublish };
}
