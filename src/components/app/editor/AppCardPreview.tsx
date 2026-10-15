"use client";

import type { EditorCard } from "@/app-api/types";
import { HiCardPresentation } from "@/components/hi/HiCardPresentation";
import { MirroredThemeProvider } from "@/components/theme/ThemeProvider";
import { editorCardToPreviewRecord } from "@/lib/app-editor/draft-to-preview-card";
import { useMemo } from "react";

type AppCardPreviewProps = {
  /** App editor theme (mirrored into the card subtree only). */
  theme: "light" | "dark";
  draft: EditorCard;
};

const PREVIEW_GREETING_PLACEHOLDER = "Your name here";

/** Live card preview: exchange inert; chips and About expand; no navigation (inert shell). */
export function AppCardPreview({ theme, draft }: AppCardPreviewProps) {
  const previewRecord = useMemo(() => editorCardToPreviewRecord(draft), [draft]);
  const photoUrl = draft.photo || null;
  const greetingOverride = !draft.name.trim()
    ? PREVIEW_GREETING_PLACEHOLDER
    : undefined;

  return (
    <MirroredThemeProvider theme={theme}>
      <div
        className="ap-card-preview-inert"
        inert
        aria-label="Card preview (read-only)"
        data-testid="app-card-preview-inert"
      >
        <HiCardPresentation
          card={previewRecord}
          photoUrl={photoUrl}
          plan="free"
          preview
          interactive
          greetingOverride={greetingOverride}
        />
      </div>
    </MirroredThemeProvider>
  );
}
