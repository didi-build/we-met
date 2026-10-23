import { describe, expect, it } from "vitest";
import {
  createContactsOAuthAttempt,
  purgeExpiredContactsOAuthAttempts,
} from "@/app-auth/contacts-oauth-attempts";
import { sha256Base64Url } from "@/app-auth/crypto";
import { withIsolatedLocalD1 } from "../helpers/d1";

describe("contacts oauth attempts purge (integration)", () => {
  it("deletes expired rows", async () => {
    await withIsolatedLocalD1(async (db) => {
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES ('a1', 'sub', 'owner@example.com', 'Owner', 'active', 't', 't')`,
        )
        .run();

      const state = "expired-state";
      const stateHash = await sha256Base64Url(state);
      await db
        .prepare(
          `INSERT INTO contacts_oauth_attempts (state_hash, account_id, pkce_verifier, created_at, expires_at)
           VALUES (?, 'a1', 'v', '2020-01-01T00:00:00.000Z', '2020-01-01T00:10:00.000Z')`,
        )
        .bind(stateHash)
        .run();

      await createContactsOAuthAttempt(db, {
        state: "fresh-state",
        accountId: "a1",
        pkceVerifier: "verifier",
      });

      await purgeExpiredContactsOAuthAttempts(db);

      const rows = await db
        .prepare("SELECT state_hash FROM contacts_oauth_attempts")
        .all<{ state_hash: string }>();
      expect(rows.results?.length).toBe(1);
      expect(rows.results?.[0]?.state_hash).not.toBe(stateHash);
    });
  });
});
