# Suspend and unsuspend (account and card)

**Purpose:** Block a abusive or compromised account without deleting history. v1 uses SQL only ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)).

**Schema check:** `accounts.status` and `cards.status` values match `migrations/0004_mvp_accounts_additive.sql` and `migrations/0005_cards_rebuild_mvp.sql` (checked **2026-10-16** by reading those files).

## Suspend

Set both account and published card to suspended. Use the same UTC timestamp for `updated_at` on both rows.

```sql
UPDATE accounts
SET status = 'suspended', updated_at = '<iso8601-utc>'
WHERE id = '<account_id>';

UPDATE cards
SET status = 'suspended', updated_at = '<iso8601-utc>'
WHERE account_id = '<account_id>';
```

### Effects

| Area                  | Behavior                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sign-in**           | **Fails** (`failed`); suspended users cannot obtain a new session ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md) §3).                                  |
| **Existing sessions** | Rows remain in `sessions` until expiry or [sign-out-everywhere](./sign-out-everywhere.md). The next `/api/app/*` call returns **403** `forbidden` (`src/app-card/route-auth.ts`). |
| **Public card**       | Lookup requires `cards.status = 'live'` and `accounts.status = 'active'` (`src/card-data/d1-repository.ts`); suspended card **404**s.                                             |
| **Exchange**          | Unreachable for that slug while suspended.                                                                                                                                        |
| **Ledger / queue**    | In-flight messages are unchanged; consumer behavior follows [0023](../decisions/0023-owner-email-lead-sink-consumer.md).                                                          |

## Unsuspend

Restore account and card to active/live:

```sql
UPDATE accounts
SET status = 'active', updated_at = '<iso8601-utc>'
WHERE id = '<account_id>';

UPDATE cards
SET status = 'live', updated_at = '<iso8601-utc>'
WHERE account_id = '<account_id>';
```

User must **sign in again** if their session was deleted or expired while suspended.

## Verify

```sql
SELECT id, status FROM accounts WHERE id = '<account_id>';
SELECT id, slug, status FROM cards WHERE account_id = '<account_id>';
```

## Related

- [account-deletion](./account-deletion.md) (permanent retire)
- [kill-switch-and-caps](./kill-switch-and-caps.md) (platform-wide lead email pause)
