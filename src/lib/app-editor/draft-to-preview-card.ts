import type { CardRecord } from "@/card-data/types";
import type { EditorCard } from "@/app-api/types";
import { previewCardShell } from "@/lib/app-editor/preview-card-shell";

/** Builds a CardRecord for the editor live preview from draft values. */
export function editorCardToPreviewRecord(
  draft: EditorCard,
  slugFallback = "preview",
): CardRecord {
  const slug = draft.slug.trim() || slugFallback;
  const name = draft.name.trim();
  const paragraphs = draft.about.map((p) => p.trim()).filter(Boolean);
  const items = draft.services
    .filter((s) => s.title.trim())
    .map((s) => ({ title: s.title.trim(), description: s.description.trim() }));

  const alternate =
    draft.alternate.url.trim() && draft.alternate.label.trim()
      ? { url: draft.alternate.url.trim(), label: draft.alternate.label.trim() }
      : undefined;

  return {
    ...previewCardShell(slug, name),
    photoKey: draft.photo ? "preview-photo" : null,
    role: draft.role.trim() || undefined,
    about: paragraphs.length ? { title: "About me", paragraphs } : undefined,
    services: items.length ? { title: "What I do", items } : undefined,
    links: draft.links,
    alternate,
  };
}
