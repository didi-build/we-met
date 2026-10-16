# Account deletion (retire and tombstone)

**Purpose:** Remove a user’s personal data while keeping stable ids for analytics (`lead_delivery_ledger`, `daily_send_counts`). There is no self-serve delete in v1; run this after a verified privacy request ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md) §7).

**Schema check:** SQL table and column names below were checked against `migrations/0004_mvp_accounts_additive.sql`, `migrations/0005_cards_rebuild_mvp.sql`, `migrations/0006_photo_upload_log.sql`, and `migrations/0001_card_lookup_schema.sql` (`lead_sinks`) on **2026-10-16** (read migrations in repo).

**D1 access:** [Running SQL against D1](./d1-operator-sql.md).

## Preconditions

- Confirm the **`account_id`** (UUID) and published **`cards.id`** / **`cards.slug`**.
- Take a one-off export if legal/compliance needs it (not stored in D1).
- Prefer running against **production** only after cutover; use non-prod to rehearse.

## 0. Suspend the account (block sign-in)

Prevent the user from signing in again and uploading a new photo while you run the steps below. **Tombstoning** (`status = 'deleted'`) still happens in [§7](#7-tombstone-the-account) at the end.

```sql
UPDATE accounts
SET status = 'suspended', updated_at = '<iso8601-utc>'
WHERE id = '<account_id>' AND status = 'active';
```

Check **rows affected**. **0** means the account was not **active** (for example already **waitlisted**, **suspended**, or **deleted**) — inspect `accounts.status` before continuing:

```sql
SELECT id, status FROM accounts WHERE id = '<account_id>';
```

## 1. End sessions

```sql
DELETE FROM sessions WHERE account_id = '<account_id>';
```

## 2. Collect photo keys (before deleting `card_drafts`)

Card photos are **content-addressed**: the R2 object key is the **SHA-256 hex** of the final 512×512 JPEG bytes, stored at the **bucket root** with no slug or account prefix (`src/images/ingest-card-photo.ts`, binding **`WE_MET_ASSETS`**).

Collect from **both** the published card and the draft row **before** you delete `card_drafts`, or you lose the draft key and may orphan that object in R2:

```sql
SELECT photo_key FROM cards WHERE id = '<card_id>';
SELECT photo_key FROM card_drafts WHERE account_id = '<account_id>';
```

Deduplicate non-null keys in your notes.

### Known gap (replaced photos)

Earlier uploads that were **replaced** in the editor are **not** referenced from D1 and **cannot** be listed by account. There is **no** orphan cleanup job in v1 ([DIDI-609](https://linear.app/didi-build/issue/DIDI-609)). This runbook only covers keys still present on `cards.photo_key` or `card_drafts.photo_key`.

## 3. Delete R2 objects (operator)

For each collected key, because storage is content-addressed, **do not delete** the object if any **other** row still references it:

```sql
SELECT COUNT(*) AS refs
FROM (
  SELECT photo_key FROM cards WHERE photo_key = '<key>' AND id != '<card_id>'
  UNION ALL
  SELECT photo_key FROM card_drafts
  WHERE photo_key = '<key>' AND account_id != '<account_id>'
);
```

When `refs = 0`, delete from **`we-met-assets`** (production) or **`we-met-assets-nonprod`** (non-prod) — object path is **`<key>`** at bucket root. Use the Cloudflare dashboard or Wrangler (**UNVERIFIED:** confirm `wrangler r2 object delete` syntax for your account before production use):

```bash
npx wrangler r2 object delete we-met-assets/<key>
```

## 4. Remove draft row and upload log

```sql
DELETE FROM card_drafts WHERE account_id = '<account_id>';
DELETE FROM photo_upload_log WHERE account_id = '<account_id>';
```

## 5. Remove lead sinks

```sql
DELETE FROM lead_sinks WHERE card_id = '<card_id>';
```

(`lead_sinks.card_id` references `cards.id` with `ON DELETE CASCADE`, but explicit delete keeps the runbook obvious.)

## 6. Retire the card (slug stays reserved)

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

Use ISO-8601 UTC strings for `updated_at` (same as `src/app-auth/time.ts`).

## 7. Tombstone the account

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

## 8. Verify

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
