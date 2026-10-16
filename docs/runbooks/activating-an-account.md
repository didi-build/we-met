# Activating an account (waitlist)

**Purpose:** Allow a specific Google user to use the editor when **`signups_open`** is off. Used at MVP cutover: maintainer signs in (creates a **waitlisted** row), is activated by SQL, publishes `didi`, then sign-ups open ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md) §7).

**Schema check:** `accounts.status` enum from `migrations/0004_mvp_accounts_additive.sql`; `signups_open` in `app_settings` seeded in `migrations/0005_cards_rebuild_mvp.sql` (checked **2026-10-16**).

**D1 access:** [Running SQL against D1](./d1-operator-sql.md).

## Waitlist behavior

When `signups_open` is `0` / false / missing:

- New Google users insert as **`waitlisted`** (`src/app-auth/accounts.ts`).
- They receive a session with **`allowed: false`**; `/api/app/*` card routes return **403** `forbidden`.
- Turning **`signups_open` on** does **not** retroactively activate waitlisted users unless they sign in again (waitlisted → active on next login when sign-ups are open).

## Find the account

By email (lowercase in DB):

```sql
SELECT id, email, name, status, google_sub, created_at
FROM accounts
WHERE email = '<owner-email>';
```

Or by `google_sub` after first sign-in.

## Activate one account

```sql
UPDATE accounts
SET status = 'active', updated_at = '<iso8601-utc>'
WHERE id = '<account_id>' AND status IN ('waitlisted', 'active');
```

User may need to refresh the editor or call `GET /api/app/session` so the client sees `allowed: true`.

## Open sign-ups (cutover step)

After the maintainer card is published:

```sql
INSERT INTO app_settings (key, value) VALUES ('signups_open', '1')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
```

Missing `signups_open` is treated as **closed** (`src/app-settings/defaults.ts`).

## Verify

```sql
SELECT key, value FROM app_settings WHERE key = 'signups_open';
SELECT id, status, email FROM accounts WHERE id = '<account_id>';
```

## Related

- [deploy-setup](./deploy-setup.md#app-host-appwe-metlink) (cutover order)
- [card-loading](./card-loading.md) (`cards:load` does not load production)
- [account-deletion](./account-deletion.md)
