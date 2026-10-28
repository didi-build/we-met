import { absoluteUrl } from "@/config/we-met";

/**
 * Published card link shown in the editor share dialog.
 * Production keeps the historical `https://we-met.link/hi/<slug>` string.
 */
export function editorPublishedCardUrl(slug: string): string {
  const weMetEnv = process.env.NEXT_PUBLIC_WE_MET_ENV;
  if (weMetEnv === "staging" || weMetEnv === "preview") {
    const base = process.env.NEXT_PUBLIC_WE_MET_BASE_URL?.trim();
    if (!base) {
      throw new Error(`Missing NEXT_PUBLIC_WE_MET_BASE_URL for ${weMetEnv} editor`);
    }
    return absoluteUrl(base, `/hi/${slug}`);
  }
  return `https://we-met.link/hi/${slug}`;
}
