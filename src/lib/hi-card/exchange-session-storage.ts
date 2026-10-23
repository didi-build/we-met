const STORAGE_KEY_PREFIX = "we-met-hi-exchange-session:";

export type ExchangeSession = {
  firstName: string;
  leadToken: string;
};

export function exchangeSessionStorageKey(slug: string): string {
  return `${STORAGE_KEY_PREFIX}${slug}`;
}

export function readExchangeSession(slug: string): ExchangeSession | null {
  try {
    const raw = window.sessionStorage.getItem(exchangeSessionStorageKey(slug));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ExchangeSession>;
    if (
      typeof parsed.firstName !== "string" ||
      typeof parsed.leadToken !== "string" ||
      !parsed.leadToken.trim()
    ) {
      return null;
    }
    return { firstName: parsed.firstName, leadToken: parsed.leadToken };
  } catch {
    return null;
  }
}

export function writeExchangeSession(slug: string, session: ExchangeSession): void {
  try {
    window.sessionStorage.setItem(
      exchangeSessionStorageKey(slug),
      JSON.stringify(session),
    );
  } catch {
    // Private mode or blocked storage; receipt still works until reload.
  }
}

export function clearExchangeSession(slug: string): void {
  try {
    window.sessionStorage.removeItem(exchangeSessionStorageKey(slug));
  } catch {
    // ignore
  }
}
