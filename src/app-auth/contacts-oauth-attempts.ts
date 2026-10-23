import { sha256Base64Url } from "@/app-auth/crypto";
import { nowIso, oauthAttemptExpiresAt } from "@/app-auth/time";
import type { D1Database } from "@cloudflare/workers-types";

export async function purgeExpiredContactsOAuthAttempts(db: D1Database): Promise<void> {
  const now = nowIso();
  await db
    .prepare("DELETE FROM contacts_oauth_attempts WHERE expires_at <= ?")
    .bind(now)
    .run();
}

export async function createContactsOAuthAttempt(
  db: D1Database,
  input: {
    state: string;
    accountId: string;
    pkceVerifier: string;
  },
): Promise<void> {
  const stateHash = await sha256Base64Url(input.state);
  const now = nowIso();
  await purgeExpiredContactsOAuthAttempts(db);
  await db
    .prepare(
      `INSERT INTO contacts_oauth_attempts (state_hash, account_id, pkce_verifier, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      stateHash,
      input.accountId,
      input.pkceVerifier,
      now,
      oauthAttemptExpiresAt(now),
    )
    .run();
}

export async function consumeContactsOAuthAttempt(
  db: D1Database,
  state: string,
): Promise<{ ok: true; accountId: string; pkceVerifier: string } | { ok: false }> {
  await purgeExpiredContactsOAuthAttempts(db);
  const stateHash = await sha256Base64Url(state);
  const row = await db
    .prepare(
      `DELETE FROM contacts_oauth_attempts WHERE state_hash = ?
       RETURNING account_id, pkce_verifier, expires_at`,
    )
    .bind(stateHash)
    .first<{
      account_id: string;
      pkce_verifier: string;
      expires_at: string;
    }>();

  if (!row) {
    return { ok: false };
  }
  if (Date.parse(row.expires_at) <= Date.now()) {
    return { ok: false };
  }
  return {
    ok: true,
    accountId: row.account_id,
    pkceVerifier: row.pkce_verifier,
  };
}
