import { describe, expect, it } from "vitest";
import { sessionAllowedForAccount, upsertAccountFromGoogle } from "@/app-auth/accounts";
import { APP_SETTING_SIGNUPS_OPEN } from "@/app-settings/defaults";
import type { D1Database } from "@cloudflare/workers-types";
import { withIsolatedLocalD1 } from "../helpers/d1";

async function setSignupsOpen(db: D1Database, open: boolean) {
  await db
    .prepare(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(APP_SETTING_SIGNUPS_OPEN, open ? "1" : "0")
    .run();
}

describe("upsertAccountFromGoogle (D1 integration)", () => {
  it("waitlists when signups closed and promotes when signups open", async () => {
    await withIsolatedLocalD1(async (db) => {
      await setSignupsOpen(db, false);
      const first = await upsertAccountFromGoogle(db, {
        sub: "g-1",
        email: "User@Example.com",
        name: "User",
      });
      expect(first.ok).toBe(true);
      if (!first.ok) {
        return;
      }
      expect(first.account.status).toBe("waitlisted");
      expect(first.account.email).toBe("user@example.com");
      expect(sessionAllowedForAccount(first.account)).toBe(false);

      await setSignupsOpen(db, true);
      const second = await upsertAccountFromGoogle(db, {
        sub: "g-1",
        email: "new@example.com",
        name: "User",
      });
      expect(second.ok).toBe(true);
      if (!second.ok) {
        return;
      }
      expect(second.account.status).toBe("active");
      expect(second.account.email).toBe("new@example.com");
      expect(sessionAllowedForAccount(second.account)).toBe(true);
    });
  });

  it("rejects suspended and deleted accounts", async () => {
    await withIsolatedLocalD1(async (db) => {
      await setSignupsOpen(db, true);
      const created = await upsertAccountFromGoogle(db, {
        sub: "g-2",
        email: "s@example.com",
        name: "S",
      });
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }
      await db
        .prepare("UPDATE accounts SET status = 'suspended' WHERE google_sub = ?")
        .bind("g-2")
        .run();
      const suspended = await upsertAccountFromGoogle(db, {
        sub: "g-2",
        email: "s@example.com",
        name: "S",
      });
      expect(suspended.ok).toBe(false);

      await db
        .prepare("UPDATE accounts SET status = 'deleted' WHERE google_sub = ?")
        .bind("g-2")
        .run();
      const deleted = await upsertAccountFromGoogle(db, {
        sub: "g-2",
        email: "s@example.com",
        name: "S",
      });
      expect(deleted.ok).toBe(false);
    });
  });
});
