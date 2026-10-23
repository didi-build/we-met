const STORAGE_KEY_PREFIX = "we-met-hi-exchange-completed:";

export function exchangeCompletedStorageKey(slug: string): string {
  return `${STORAGE_KEY_PREFIX}${slug}`;
}

/** Set when step 1 exchange succeeds; used for post-reload fallback UI. */
export function readExchangeCompletedFlag(slug: string): boolean {
  try {
    return window.localStorage.getItem(exchangeCompletedStorageKey(slug)) === "1";
  } catch {
    return false;
  }
}

export function writeExchangeCompletedFlag(slug: string): void {
  try {
    window.localStorage.setItem(exchangeCompletedStorageKey(slug), "1");
  } catch {
    // Private mode or blocked storage.
  }
}
