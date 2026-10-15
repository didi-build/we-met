import { randomToken, sha256Base64Url } from "@/app-auth/crypto";
import {
  nowIso,
  oauthAttemptExpiresAt,
  sessionExpiryFrom,
  shouldTouchSessionLastSeen,
} from "@/app-auth/time";
import type { AccountRow } from "@/app-auth/accounts";
import type { D1Database } from "@cloudflare/workers-types";

export type SessionRow = {
  token_hash: string;
  account_id: string;
  created_at: string;
  expires_at: string;
  absolute_expires_at: string;
  last_seen_at: string;
};

export type ValidSession = {
  token: string;
  accountId: string;
};

export async function createSession(
  db: D1Database,
  accountId: string,
): Promise<ValidSession> {
  const token = randomToken(32);
  const tokenHash = await sha256Base64Url(token);
  const now = nowIso();
  const { expiresAt, absoluteExpiresAt } = sessionExpiryFrom(now);

  await db
    .prepare(
      `INSERT INTO sessions (
         token_hash, account_id, created_at, expires_at, absolute_expires_at, last_seen_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(tokenHash, accountId, now, expiresAt, absoluteExpiresAt, now)
    .run();

  return { token, accountId };
}

export async function deleteSessionByToken(
  db: D1Database,
  token: string,
): Promise<void> {
  const tokenHash = await sha256Base64Url(token);
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export async function loadSessionByToken(
  db: D1Database,
  token: string,
): Promise<SessionRow | null> {
  const tokenHash = await sha256Base64Url(token);
  return await db
    .prepare(
      `SELECT token_hash, account_id, created_at, expires_at, absolute_expires_at, last_seen_at
       FROM sessions WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .first<SessionRow>();
}

export async function validateAndTouchSession(
  db: D1Database,
  token: string,
): Promise<{ accountId: string } | null> {
  const row = await loadSessionByToken(db, token);
  if (!row) {
    return null;
  }
  const now = nowIso();
  if (Date.parse(row.expires_at) <= Date.parse(now)) {
    await db
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(row.token_hash)
      .run();
    return null;
  }
  if (Date.parse(row.absolute_expires_at) <= Date.parse(now)) {
    await db
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(row.token_hash)
      .run();
    return null;
  }

  if (shouldTouchSessionLastSeen(row.last_seen_at, now)) {
    const { expiresAt } = sessionExpiryFrom(now);
    await db
      .prepare(
        "UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?",
      )
      .bind(now, expiresAt, row.token_hash)
      .run();
  }

  return { accountId: row.account_id };
}

export type OAuthAttemptMode = "redirect" | "popup";

export async function createOAuthAttempt(
  db: D1Database,
  input: {
    state: string;
    nonce: string;
    pkceVerifier: string;
    mode: OAuthAttemptMode;
  },
): Promise<void> {
  const stateHash = await sha256Base64Url(input.state);
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO oauth_attempts (state_hash, nonce, pkce_verifier, mode, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      stateHash,
      input.nonce,
      input.pkceVerifier,
      input.mode,
      now,
      oauthAttemptExpiresAt(now),
    )
    .run();
}

export async function consumeOAuthAttempt(
  db: D1Database,
  state: string,
): Promise<
  | { ok: true; nonce: string; pkceVerifier: string; mode: OAuthAttemptMode }
  | { ok: false }
> {
  const stateHash = await sha256Base64Url(state);
  const row = await db
    .prepare(
      "SELECT state_hash, nonce, pkce_verifier, mode, expires_at FROM oauth_attempts WHERE state_hash = ?",
    )
    .bind(stateHash)
    .first<{
      state_hash: string;
      nonce: string;
      pkce_verifier: string;
      mode: OAuthAttemptMode;
      expires_at: string;
    }>();

  await db
    .prepare("DELETE FROM oauth_attempts WHERE state_hash = ?")
    .bind(stateHash)
    .run();

  if (!row) {
    return { ok: false };
  }
  if (Date.parse(row.expires_at) <= Date.now()) {
    return { ok: false };
  }
  return {
    ok: true,
    nonce: row.nonce,
    pkceVerifier: row.pkce_verifier,
    mode: row.mode,
  };
}

export async function loadAccountForSession(
  db: D1Database,
  accountId: string,
): Promise<AccountRow | null> {
  return await db
    .prepare("SELECT id, google_sub, email, name, status FROM accounts WHERE id = ?")
    .bind(accountId)
    .first<AccountRow>();
}
