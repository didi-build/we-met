"use client";

import type { EditorCard } from "@/app-api/types";
import { HiCardPresentation } from "@/components/hi/HiCardPresentation";
import { MirroredThemeProvider } from "@/components/theme/ThemeProvider";
import { editorCardToPreviewRecord } from "@/lib/app-editor/draft-to-preview-card";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

type AppCardPreviewProps = {
  /** App editor theme (mirrored into the card subtree only). */
  theme: "light" | "dark";
  draft: EditorCard;
};

const PREVIEW_GREETING_PLACEHOLDER = "Your name here";

/** Block navigation from preview links (capture phase); chips and About stay interactive. */
export function blockPreviewLinkNavigation(
  event: React.MouseEvent | React.KeyboardEvent,
  root: HTMLElement | null,
): void {
  if (!root) {
    return;
  }
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const anchor = target.closest("a");
  if (!anchor || !root.contains(anchor)) {
    return;
  }
  if (event.type === "keydown") {
    const key = (event as React.KeyboardEvent).key;
    if (key !== "Enter" && key !== " ") {
      return;
    }
  }
  event.preventDefault();
}

/** Live card preview: Exchange disabled via `preview`; chips/About interactive; links do not navigate. */
export function AppCardPreview({ theme, draft }: AppCardPreviewProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const previewRecord = useMemo(() => editorCardToPreviewRecord(draft), [draft]);
  const photoUrl = draft.photo || null;
  const greetingOverride = !draft.name.trim()
    ? PREVIEW_GREETING_PLACEHOLDER
    : undefined;

  useLayoutEffect(() => {
    const root = shellRef.current;
    if (!root) {
      return;
    }
    root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
      anchor.tabIndex = -1;
    });
  }, [previewRecord]);

  const onCapture = useCallback((event: React.MouseEvent | React.KeyboardEvent) => {
    blockPreviewLinkNavigation(event, shellRef.current);
  }, []);

  return (
    <MirroredThemeProvider theme={theme}>
      <div
        ref={shellRef}
        className="ap-card-preview-shell"
        aria-label="Card preview"
        data-testid="app-card-preview"
        onClickCapture={onCapture}
        onKeyDownCapture={onCapture}
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
