import { readSignupsOpen } from "@/app-auth/app-settings";
import { nowIso } from "@/app-auth/time";
import type { D1Database } from "@cloudflare/workers-types";

export type AccountRow = {
  id: string;
  google_sub: string;
  email: string;
  name: string;
  status: "waitlisted" | "active" | "suspended" | "deleted";
};

export type AccountSignInResult =
  { ok: true; account: AccountRow } | { ok: false; reason: "suspended" | "deleted" };

function initialStatus(signupsOpen: boolean): AccountRow["status"] {
  return signupsOpen ? "active" : "waitlisted";
}

export async function upsertAccountFromGoogle(
  db: D1Database,
  input: { sub: string; email: string; name: string },
): Promise<AccountSignInResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim() || email;
  const signupsOpen = await readSignupsOpen(db);
  const now = nowIso();

  const existing = await db
    .prepare(
      "SELECT id, google_sub, email, name, status FROM accounts WHERE google_sub = ?",
    )
    .bind(input.sub)
    .first<AccountRow>();

  if (!existing) {
    const id = crypto.randomUUID();
    const status = initialStatus(signupsOpen);
    await db
      .prepare(
        `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, input.sub, email, name, status, now, now, now)
      .run();
    return {
      ok: true,
      account: { id, google_sub: input.sub, email, name, status },
    };
  }

  if (existing.status === "suspended" || existing.status === "deleted") {
    return { ok: false, reason: existing.status };
  }

  let status = existing.status;
  if (status === "waitlisted" && signupsOpen) {
    status = "active";
  }

  const emailChanged = existing.email !== email;
  const nameChanged = existing.name !== name;
  const statusChanged = status !== existing.status;

  if (emailChanged || nameChanged || statusChanged) {
    await db
      .prepare(
        `UPDATE accounts
         SET email = ?, name = ?, status = ?, updated_at = ?, last_login_at = ?
         WHERE id = ?`,
      )
      .bind(email, name, status, now, now, existing.id)
      .run();
  } else {
    await db
      .prepare("UPDATE accounts SET last_login_at = ?, updated_at = ? WHERE id = ?")
      .bind(now, now, existing.id)
      .run();
  }

  return {
    ok: true,
    account: {
      id: existing.id,
      google_sub: existing.google_sub,
      email,
      name,
      status,
    },
  };
}

export async function upsertPreviewTestAccount(
  db: D1Database,
  input: { email: string },
): Promise<AccountRow> {
  const sub = "preview:test";
  const email = input.email.trim().toLowerCase();
  const name = "Preview test";
  const now = nowIso();

  const existing = await db
    .prepare(
      "SELECT id, google_sub, email, name, status FROM accounts WHERE google_sub = ?",
    )
    .bind(sub)
    .first<AccountRow>();

  if (!existing) {
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at, last_login_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
      )
      .bind(id, sub, email, name, now, now, now)
      .run();
    return { id, google_sub: sub, email, name, status: "active" };
  }

  await db
    .prepare(
      `UPDATE accounts
       SET email = ?, name = ?, status = 'active', updated_at = ?, last_login_at = ?
       WHERE id = ?`,
    )
    .bind(email, name, now, now, existing.id)
    .run();

  return {
    id: existing.id,
    google_sub: sub,
    email,
    name,
    status: "active",
  };
}

export function sessionAllowedForAccount(account: AccountRow): boolean {
  return account.status === "active";
}
