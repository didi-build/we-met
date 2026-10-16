# Sign out everywhere

**Purpose:** Invalidate all server-side sessions for one account (stolen cookie, offboarding step before [account-deletion](./account-deletion.md)). v1 has no UI button ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md) §3).

**Schema check:** `sessions` columns from `migrations/0004_mvp_accounts_additive.sql` (checked **2026-10-16**).

**D1 access:** [Running SQL against D1](./d1-operator-sql.md).

## Delete session rows

```sql
DELETE FROM sessions WHERE account_id = '<account_id>';
```

Optional count before/after:

```sql
SELECT COUNT(*) AS n FROM sessions WHERE account_id = '<account_id>';
```

## Effects

- Existing `__Host-wm_session` cookies stop working on the next request (**401** `unauthorized`).
- User can sign in again unless `accounts.status` is `suspended` or `deleted`.
- Does **not** change card publish state or public URLs.

## Related

- [suspend-and-unsuspend](./suspend-and-unsuspend.md)
- [account-deletion](./account-deletion.md) (also deletes sessions)
