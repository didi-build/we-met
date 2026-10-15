"use client";

import type { EditorCard } from "@/app-api/types";
import { HiPageClient } from "@/components/hi/HiPageClient";
import { MirroredThemeProvider } from "@/components/theme/ThemeProvider";
import { editorCardToPreviewRecord } from "@/lib/app-editor/draft-to-preview-card";
import { useMemo } from "react";

type AppCardPreviewProps = {
  /** App editor theme (mirrored into the card subtree only). */
  theme: "light" | "dark";
  draft: EditorCard;
};

/** Live card preview: read-only, no navigation or exchange. */
export function AppCardPreview({ theme, draft }: AppCardPreviewProps) {
  const previewRecord = useMemo(() => editorCardToPreviewRecord(draft), [draft]);
  const photoUrl = draft.photo || null;

  return (
    <MirroredThemeProvider theme={theme}>
      <div
        className="ap-card-preview-inert"
        inert
        aria-label="Card preview (read-only)"
        data-testid="app-card-preview-inert"
      >
        <HiPageClient card={previewRecord} photoUrl={photoUrl} preview />
      </div>
    </MirroredThemeProvider>
  );
}
