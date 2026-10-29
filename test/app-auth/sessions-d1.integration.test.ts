import { describe, expect, it } from "vitest";
import { upsertAccountFromGoogle } from "@/app-auth/accounts";
import {
  createSession,
  loadSessionByToken,
  validateAndTouchSession,
} from "@/app-auth/sessions";
import { withIsolatedLocalD1 } from "../helpers/d1";

describe("app-auth sessions (D1 integration)", () => {
  it("creates and validates a session", async () => {
    await withIsolatedLocalD1(async (db) => {
      const account = await upsertAccountFromGoogle(db, {
        sub: "google-sub-1",
        email: "owner@example.com",
        name: "Owner",
      });
      expect(account.ok).toBe(true);
      if (!account.ok) {
        return;
      }

      const session = await createSession(db, account.account.id);
      const row = await loadSessionByToken(db, session.token);
      expect(row?.account_id).toBe(account.account.id);

      const valid = await validateAndTouchSession(db, session.token);
      expect(valid?.accountId).toBe(account.account.id);
    });
  });
});
