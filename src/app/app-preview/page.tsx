import { notFound } from "next/navigation";

/** Removed in MVP phase 3; the real app lives at `/app` (local/previews) or `/` (production app host). */
export default function AppPreviewRemovedPage() {
  notFound();
}
