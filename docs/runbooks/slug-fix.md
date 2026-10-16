# Slug fix (first-publish typo only)

**Purpose:** One-time manual correction when an owner publishes with a typo immediately after go-live. Slugs are **immutable** in the app after first publish ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md) §5); this runbook is the v1 exception.

**Schema check:** `cards.slug` and unique index `cards_slug_unique` from `migrations/0005_cards_rebuild_mvp.sql` (checked **2026-10-16**).

**D1 access:** [Running SQL against D1](./d1-operator-sql.md).

## Preconditions

- Support ticket confirms a **first-publish typo**, not a rebrand.
- New slug passes product rules (3–40 chars, lowercase, hyphens; not reserved — same rules as `checkSlug`).
- New slug is **not** taken:

```sql
SELECT account_id, slug, status FROM cards WHERE slug IN ('<wrong_slug>', '<correct_slug>');
```

## Update slug

```sql
UPDATE cards
SET slug = '<correct_slug>', updated_at = '<iso8601-utc>'
WHERE account_id = '<account_id>' AND slug = '<wrong_slug>';
```

If the statement affects **0 rows**, stop and reconcile `account_id` / slug.

## Lead sink ids

**Leave `lead_sinks.id` unchanged.** The `{slug}-` id prefix is enforced only in **`cards:load`** (`src/card-data/load-file.ts`), not at runtime. Renaming sink ids would not match **`lead_delivery_ledger.sink_id`** or messages already on the queue.

## Follow-up email and old links

Owner notification emails already sent include the **old** card URL (`/hi/<wrong_slug>`). After this fix, that link **404**s; there is no redirect in v1. Tell the owner to use the corrected link in future outreach.

## Verify

- `SELECT slug, status FROM cards WHERE account_id = '<account_id>';`
- Open `https://we-met.link/hi/<correct_slug>` (or non-prod equivalent).
- Old slug `/hi/<wrong_slug>` should **404**.

## Related

- [app-api-contract](../architecture/app-api-contract.md) (`slug-locked` in the editor)
- ADR [0025 §5](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)
