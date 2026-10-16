# Account deletion (retire and tombstone)

**Purpose:** Remove a user’s personal data while keeping stable ids for analytics (`lead_delivery_ledger`, `daily_send_counts`). There is no self-serve delete in v1; run this after a verified privacy request ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md) §7).

**Schema check:** SQL table and column names below were checked against `migrations/0004_mvp_accounts_additive.sql`, `migrations/0005_cards_rebuild_mvp.sql`, `migrations/0006_photo_upload_log.sql`, and `migrations/0001_card_lookup_schema.sql` (`lead_sinks`) on **2026-10-16** (read migrations in repo).

## Preconditions

- Confirm the **`account_id`** (UUID) and published **`cards.id`** / **`cards.slug`**.
- Take a one-off export if legal/compliance needs it (not stored in D1).
- Prefer running against **production** only after cutover; use non-prod to rehearse.

## 1. End sessions and draft

```sql
DELETE FROM sessions WHERE account_id = '<account_id>';
DELETE FROM card_drafts WHERE account_id = '<account_id>';
DELETE FROM photo_upload_log WHERE account_id = '<account_id>';
```

## 2. Remove lead sinks

```sql
DELETE FROM lead_sinks WHERE card_id = '<card_id>';
```

(`lead_sinks.card_id` references `cards.id` with `ON DELETE CASCADE`, but explicit delete keeps the runbook obvious.)

## 3. Delete R2 photo objects (operator)

Collect keys from D1 before blanking:

```sql
SELECT photo_key FROM cards WHERE id = '<card_id>';
```

For each non-null `photo_key`, delete the object from bucket **`we-met-assets`** (production) or **`we-met-assets-nonprod`** (non-prod) using the Cloudflare dashboard or:

```bash
npx wrangler r2 object delete we-met-assets/<photo_key>
```

(Replace bucket name per environment. **UNVERIFIED:** exact Wrangler R2 syntax for your account — confirm against current Wrangler docs before production use.)

## 4. Retire the card (slug stays reserved)

Blank published content and mark retired. Minimal JSON satisfies `NOT NULL` columns; the slug remains taken.

```sql
UPDATE cards
SET
  display_name = '',
  photo_key = NULL,
  links_json = '{}',
  page_copy_json = '{}',
  contact_json = '{}',
  copy_json = '{}',
  status = 'retired',
  updated_at = '<iso8601-utc>'
WHERE id = '<card_id>' AND account_id = '<account_id>';
```

Use `datetime('now')` only if your D1 session uses SQLite text timestamps consistently; the app writes ISO-8601 UTC strings (`src/app-auth/time.ts`).

## 5. Tombstone the account

```sql
UPDATE accounts
SET
  google_sub = 'deleted:' || id,
  email = '',
  name = '',
  status = 'deleted',
  updated_at = '<iso8601-utc>'
WHERE id = '<account_id>';
```

`google_sub` must stay **unique**; `deleted:<id>` is the v1 pattern ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)).

## 6. Verify

```sql
SELECT id, status, google_sub, email FROM accounts WHERE id = '<account_id>';
SELECT id, slug, status, display_name, photo_key FROM cards WHERE account_id = '<account_id>';
SELECT COUNT(*) AS sessions_left FROM sessions WHERE account_id = '<account_id>';
```

Public `/hi/<slug>` should **404**. Whether a retired slug can ever be reused is **undecided** ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)).

## Related

- [activating-an-account](./activating-an-account.md) (inverse for waitlist)
- [sign-out-everywhere](./sign-out-everywhere.md) (sessions only)
- ADR [0025 §7](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)
