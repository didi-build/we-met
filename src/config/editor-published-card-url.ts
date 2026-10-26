import { absoluteUrl } from "@/config/we-met";

/**
 * Published card link shown in the editor share dialog.
 * Production keeps the historical `https://we-met.link/hi/<slug>` string.
 */
export function editorPublishedCardUrl(slug: string): string {
  if (process.env.NEXT_PUBLIC_WE_MET_ENV === "staging") {
    const base = process.env.NEXT_PUBLIC_WE_MET_BASE_URL?.trim();
    if (!base) {
      throw new Error("Missing NEXT_PUBLIC_WE_MET_BASE_URL for staging editor");
    }
    return absoluteUrl(base, `/hi/${slug}`);
  }
  return `https://we-met.link/hi/${slug}`;
}
