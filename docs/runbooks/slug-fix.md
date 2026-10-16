# Slug fix (first-publish typo only)

**Purpose:** One-time manual correction when an owner publishes with a typo immediately after go-live. Slugs are **immutable** in the app after first publish ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md) §5); this runbook is the v1 exception.

**Schema check:** `cards.slug` and unique index `cards_slug_unique` from `migrations/0005_cards_rebuild_mvp.sql` (checked **2026-10-16**).

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

## Lead sink ids (if needed)

Loader and publish use sink ids prefixed with `{slug}-`. If sinks were created with the wrong prefix, update ids consistently (example — adjust ids to match your row):

```sql
SELECT id, card_id FROM lead_sinks WHERE card_id = '<card_id>';
-- UPDATE lead_sinks SET id = '<correct_slug>-owner-inbox' WHERE id = '<wrong_slug>-owner-inbox';
```

Only run sink id updates when ids actually embed the typo; email sink config stays `{ "to": "account_email" }`.

## Verify

- `SELECT slug, status FROM cards WHERE account_id = '<account_id>';`
- Open `https://we-met.link/hi/<correct_slug>` (or non-prod equivalent).
- Old slug `/hi/<wrong_slug>` should **404**.

## Related

- [app-api-contract](../architecture/app-api-contract.md) (`slug-locked` in the editor)
- ADR [0025 §5](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)
