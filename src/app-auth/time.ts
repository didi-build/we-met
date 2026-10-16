const DAY_MS = 24 * 60 * 60 * 1000;
const SLIDING_MS = 30 * DAY_MS;
const ABSOLUTE_MS = 90 * DAY_MS;
const OAUTH_ATTEMPT_MS = 10 * 60 * 1000;

export function nowIso(): string {
  return new Date().toISOString();
}

export function addMsIso(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

export function sessionExpiryFrom(now: string): {
  expiresAt: string;
  absoluteExpiresAt: string;
} {
  return {
    expiresAt: addMsIso(now, SLIDING_MS),
    absoluteExpiresAt: addMsIso(now, ABSOLUTE_MS),
  };
}

export function oauthAttemptExpiresAt(now: string): string {
  return addMsIso(now, OAUTH_ATTEMPT_MS);
}

export function shouldTouchSessionLastSeen(lastSeenAt: string, now: string): boolean {
  return Date.parse(now) - Date.parse(lastSeenAt) >= DAY_MS;
}

/** Cookie Max-Age: min(30d sliding window, time until absolute expiry). */
export function sessionCookieMaxAgeSeconds(
  absoluteExpiresAt: string,
  slidingExpiresAt: string,
  nowMs: number = Date.now(),
): number {
  const slidingCap = Math.floor(SLIDING_MS / 1000);
  const toAbsolute = Math.floor((Date.parse(absoluteExpiresAt) - nowMs) / 1000);
  const toSliding = Math.floor((Date.parse(slidingExpiresAt) - nowMs) / 1000);
  return Math.max(0, Math.min(slidingCap, toAbsolute, toSliding));
}

export { SLIDING_MS, ABSOLUTE_MS, DAY_MS };
