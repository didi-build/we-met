import { describe, expect, it, vi } from "vitest";
import {
  SESSION_SLIDING_MAX_AGE_SECONDS,
  sessionCookieValue,
} from "@/app-auth/cookies";
import { buildAppSessionJson } from "@/app-auth/session-response";
import {
  createSession,
  deleteSessionByToken,
  validateAndTouchSession,
} from "@/app-auth/sessions";
import { sessionCookieMaxAgeSeconds, addMsIso, nowIso } from "@/app-auth/time";
import { upsertAccountFromGoogle } from "@/app-auth/accounts";
import { withIsolatedLocalD1 } from "../helpers/d1";

describe("session rules (D1 integration)", () => {
  it("expires sliding and absolute sessions and touches last_seen at most once per day", async () => {
    await withIsolatedLocalD1(async (db) => {
      const account = await upsertAccountFromGoogle(db, {
        sub: "sess-1",
        email: "a@example.com",
        name: "A",
      });
      expect(account.ok).toBe(true);
      if (!account.ok) {
        return;
      }

      const session = await createSession(db, account.account.id);
      const row = await validateAndTouchSession(db, session.token);
      expect(row?.accountId).toBe(account.account.id);

      const now = nowIso();
      await db
        .prepare("UPDATE sessions SET expires_at = ? WHERE account_id = ?")
        .bind(addMsIso(now, -1000), account.account.id)
        .run();
      expect(await validateAndTouchSession(db, session.token)).toBeNull();

      const session2 = await createSession(db, account.account.id);
      await db
        .prepare("UPDATE sessions SET absolute_expires_at = ? WHERE account_id = ?")
        .bind(addMsIso(now, -1000), account.account.id)
        .run();
      expect(await validateAndTouchSession(db, session2.token)).toBeNull();

      const session3 = await createSession(db, account.account.id);
      const t1 = await validateAndTouchSession(db, session3.token);
      expect(t1).not.toBeNull();
      const t2 = await validateAndTouchSession(db, session3.token);
      expect(t2).not.toBeNull();
      const stored = await db
        .prepare("SELECT last_seen_at FROM sessions WHERE account_id = ?")
        .bind(account.account.id)
        .first<{ last_seen_at: string }>();
      const lastSeen = stored?.last_seen_at;
      await validateAndTouchSession(db, session3.token);
      const stored2 = await db
        .prepare("SELECT last_seen_at FROM sessions WHERE account_id = ?")
        .bind(account.account.id)
        .first<{ last_seen_at: string }>();
      expect(stored2?.last_seen_at).toBe(lastSeen);
    });
  });

  it("logout deletes the session row and suspended accounts are not allowed", async () => {
    await withIsolatedLocalD1(async (db) => {
      const account = await upsertAccountFromGoogle(db, {
        sub: "sess-2",
        email: "b@example.com",
        name: "B",
      });
      expect(account.ok).toBe(true);
      if (!account.ok) {
        return;
      }
      const session = await createSession(db, account.account.id);
      await deleteSessionByToken(db, session.token);
      expect(await validateAndTouchSession(db, session.token)).toBeNull();

      const session2 = await createSession(db, account.account.id);
      await db
        .prepare("UPDATE accounts SET status = 'suspended' WHERE id = ?")
        .bind(account.account.id)
        .run();
      const built = await buildAppSessionJson(db, session2.token);
      expect(built.session?.allowed).toBe(false);
    });
  });

  it("re-issues cookie max-age bounded by absolute expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const absolute = "2026-01-20T00:00:00.000Z";
    const sliding = "2026-02-01T00:00:00.000Z";
    const maxAge = sessionCookieMaxAgeSeconds(absolute, sliding);
    expect(maxAge).toBeLessThan(SESSION_SLIDING_MAX_AGE_SECONDS);
    expect(maxAge).toBe(19 * 24 * 60 * 60);
    const cookie = sessionCookieValue("token", maxAge);
    expect(cookie).toContain(`Max-Age=${maxAge}`);
    vi.useRealTimers();
  });
});
