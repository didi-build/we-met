const EXCHANGE_SESSION_KEY_PREFIX = "we-met-hi-exchange-session:";
const EXCHANGE_COMPLETED_KEY_PREFIX = "we-met-hi-exchange-completed:";

export type HiExchangeSession = {
  firstName: string;
  visitorEmail: string;
  leadToken: string;
  ownerEmail: string;
  ownerPhone: string;
};

export function exchangeSessionStorageKey(slug: string): string {
  return `${EXCHANGE_SESSION_KEY_PREFIX}${slug}`;
}

export function exchangeCompletedStorageKey(slug: string): string {
  return `${EXCHANGE_COMPLETED_KEY_PREFIX}${slug}`;
}

export function readExchangeSession(slug: string): HiExchangeSession | null {
  try {
    const raw = window.sessionStorage.getItem(exchangeSessionStorageKey(slug));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<HiExchangeSession>;
    const firstName = typeof parsed.firstName === "string" ? parsed.firstName : "";
    const visitorEmail =
      typeof parsed.visitorEmail === "string" ? parsed.visitorEmail : "";
    const leadToken = typeof parsed.leadToken === "string" ? parsed.leadToken : "";
    const ownerEmail = typeof parsed.ownerEmail === "string" ? parsed.ownerEmail : "";
    const ownerPhone = typeof parsed.ownerPhone === "string" ? parsed.ownerPhone : "";
    if (!leadToken) {
      return null;
    }
    return { firstName, visitorEmail, leadToken, ownerEmail, ownerPhone };
  } catch {
    return null;
  }
}

export function writeExchangeSession(slug: string, session: HiExchangeSession): void {
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
    // ignore
  }
}
