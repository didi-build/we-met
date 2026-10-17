"use client";

import type { EditorCard } from "@/app-api/types";
import { HiCardPresentation } from "@/components/hi/HiCardPresentation";
import { MirroredThemeProvider } from "@/components/theme/ThemeProvider";
import { editorCardToPreviewRecord } from "@/lib/app-editor/draft-to-preview-card";
import { useLayoutEffect, useMemo, useRef } from "react";

type AppCardPreviewProps = {
  /** App editor theme (mirrored into the card subtree only). */
  theme: "light" | "dark";
  draft: EditorCard;
  /** Google account name when display name is empty (editor preview only). */
  googleName?: string;
};

const PREVIEW_GREETING_PLACEHOLDER = "Your name here";

/** Block navigation from preview links; chips and About stay interactive. */
export function blockPreviewLinkNavigation(
  event: Event,
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
    const key = (event as KeyboardEvent).key;
    if (key !== "Enter" && key !== " ") {
      return;
    }
  }
  event.preventDefault();
}

/** Live card preview: Exchange disabled via `preview`; chips/About interactive; links do not navigate. */
export function AppCardPreview({ theme, draft, googleName = "" }: AppCardPreviewProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const previewRecord = useMemo(
    () => editorCardToPreviewRecord(draft, "preview", googleName),
    [draft, googleName],
  );
  const photoUrl = draft.photo || null;
  const greetingOverride =
    !draft.name.trim() && !googleName.trim() ? PREVIEW_GREETING_PLACEHOLDER : undefined;

  useLayoutEffect(() => {
    const root = shellRef.current;
    if (!root) {
      return;
    }
    const anchors = root.querySelectorAll<HTMLAnchorElement>("a[href]");
    const cleanups: (() => void)[] = [];
    anchors.forEach((anchor) => {
      anchor.tabIndex = -1;
      const onClick = (event: Event) => blockPreviewLinkNavigation(event, root);
      const onKeyDown = (event: Event) => blockPreviewLinkNavigation(event, root);
      anchor.addEventListener("click", onClick, true);
      anchor.addEventListener("keydown", onKeyDown, true);
      cleanups.push(() => {
        anchor.removeEventListener("click", onClick, true);
        anchor.removeEventListener("keydown", onKeyDown, true);
      });
    });
    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [previewRecord]);

  return (
    <MirroredThemeProvider theme={theme}>
      <div
        ref={shellRef}
        className="ap-card-preview-shell"
        aria-label="Card preview"
        data-testid="app-card-preview"
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
