const STORAGE_KEY_PREFIX = "we-met-hi-details-sent:";

export function detailsSentStorageKey(slug: string): string {
  return `${STORAGE_KEY_PREFIX}${slug}`;
}

export function readDetailsSentFlag(slug: string): boolean {
  try {
    return window.localStorage.getItem(detailsSentStorageKey(slug)) === "1";
  } catch {
    return false;
  }
}

export function writeDetailsSentFlag(slug: string): void {
  try {
    window.localStorage.setItem(detailsSentStorageKey(slug), "1");
  } catch {
    // Private mode or blocked storage; page still works without persistence.
  }
}
