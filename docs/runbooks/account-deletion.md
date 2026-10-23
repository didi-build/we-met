# Account deletion (retire and tombstone)

**Purpose:** Remove a user’s personal data while keeping stable ids for analytics (`lead_delivery_ledger`, `daily_send_counts`). There is no self-serve delete in v1; run this after a verified privacy request ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md) §7).

**Inventory:** Every personal-information store in [`docs/privacy/data-map.yml`](../privacy/data-map.yml) is covered in the steps below or in [Data map coverage](#data-map-coverage).

**Schema check:** SQL table and column names below were checked against `migrations/0004_mvp_accounts_additive.sql`, `migrations/0005_cards_rebuild_mvp.sql`, `migrations/0006_photo_upload_log.sql`, `migrations/0007_contacts_setup.sql`, and `migrations/0001_card_lookup_schema.sql` (`lead_sinks`) on **2026-10-23** (read migrations in repo).

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

Ends server-side session rows and invalidates the `__Host-wm_session` cookie on next request. OAuth state cookies expire independently (10 minutes).

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

## 5b. Queue messages (no operator purge)

Visitor lead data in flight is **not** stored in D1. It may exist in Cloudflare Queue messages (`queue.visitor_followup`, `queue.lead_sink_record`, `queue.lead_sink_append_details`) until the consumer succeeds or retention expires.

- There is **no** API in v1 to delete a specific account’s messages from the queue.
- After you suspend the account and retire the card, new exchanges should not enqueue; **already-queued** messages may still deliver until processed or until queue retention (**86,400 s / 24 h** per dashboard read **2026-10-17**; see data map — retention is **not** pinned in repo).
- Document the deletion request time in your ticket; if legal needs assurance no pending messages remain, wait one full retention window after the last known enqueue for that card, or escalate for a manual Cloudflare queue inspection (operator-only, **UNVERIFIED** procedure).

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
  contact_added_at = NULL,
  contact_sender_addresses = NULL,
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

Custom hostname rows in `hostnames` (if any for this card) remain tied to the retired card id until removed separately; v1 cards typically use `/hi/<slug>` only.

## Data map coverage

Each row in [`data-map.yml`](../privacy/data-map.yml) with `whose: card_owner` or `whose: visitor` (and card-owner operational rows tied to the account) must be deleted here or explicitly **kept**. Global operational rows with no per-user personal data are marked **n/a**.

| Data-map `id`                                                                                                                                 | Action in this runbook                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accounts.id`                                                                                                                                 | **Kept:** tombstone row retains UUID for ledger and counts ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)).                                                                        |
| `accounts.google_sub`                                                                                                                         | **Tombstone:** §7 sets `deleted:<id>`.                                                                                                                                                                        |
| `accounts.email`, `accounts.name`                                                                                                             | **Blanked:** §7.                                                                                                                                                                                              |
| `accounts.contact_added_at`, `accounts.contact_sender_addresses`                                                                              | **Cleared:** §7.                                                                                                                                                                                              |
| `accounts.status`, `accounts.created_at`, `accounts.updated_at`, `accounts.last_login_at`                                                     | **Kept** on tombstone: operational lifecycle and audit timestamps.                                                                                                                                            |
| `sessions.*`                                                                                                                                  | **Deleted:** §1.                                                                                                                                                                                              |
| `oauth_attempts.*`                                                                                                                            | **Not per-account:** short-lived OAuth rows; no deletion step (expire in ~10 minutes; consumed on callback).                                                                                                  |
| `contacts_oauth_attempts.*`                                                                                                                   | **Not per-account:** short-lived contacts OAuth rows; expire in ~10 minutes; purged when expired or consumed on callback.                                                                                     |
| `card_drafts.*`                                                                                                                               | **Deleted:** §4 (`draft_json`, `photo_key` cleared with row).                                                                                                                                                 |
| `cards.id`, `cards.slug`, `cards.status`, `cards.account_id`, `cards.updated_at`                                                              | **Kept:** retired card row; slug reserved.                                                                                                                                                                    |
| `cards.display_name`, `cards.variant`, `cards.photo_key`, `cards.links_json`, `cards.page_copy_json`, `cards.contact_json`, `cards.copy_json` | **Blanked or nulled:** §6.                                                                                                                                                                                    |
| `hostnames.*`                                                                                                                                 | **Kept** if present: routing row for retired card unless operator removes hostname separately.                                                                                                                |
| `lead_sinks.*`                                                                                                                                | **Deleted:** §5.                                                                                                                                                                                              |
| `lead_delivery_ledger.*`                                                                                                                      | **Kept:** indefinite; no visitor lead content in ledger (ADR 0022).                                                                                                                                           |
| `daily_send_counts.*`                                                                                                                         | **Kept:** indefinite aggregate counts per card/day (no lead contents).                                                                                                                                        |
| `photo_upload_log.*`                                                                                                                          | **Deleted:** §4.                                                                                                                                                                                              |
| `app_settings.*`                                                                                                                              | **n/a:** global feature flags, not account personal data.                                                                                                                                                     |
| `storage.r2.card_photo`                                                                                                                       | **Deleted when unreferenced:** §2–3; replaced uploads without D1 reference **not** deleted (orphans: see §2).                                                                                                 |
| `storage.d1_restore_points`                                                                                                                   | **Kept:** Cloudflare D1 Time Travel may retain deleted rows until restore-window expiry; plan and window **vendor-dependent** (`verified: false` in map). Operator cannot purge via this runbook.             |
| `storage.nonprod_environment`                                                                                                                 | **n/a** for production deletion: separate bindings; whether PII exists in non-prod is **unknown** from repo.                                                                                                  |
| `queue.visitor_followup`, `queue.lead_sink_record`, `queue.lead_sink_append_details`                                                          | **No targeted purge:** §5b; rely on consumer + retention.                                                                                                                                                     |
| `email.owner_lead_record`, `email.owner_lead_append`, `email.visitor_followup`                                                                | **Not in D1:** copies may remain in card-owner or visitor **mailboxes**; retention **unknown** (`verified: false`). Inform the requester email is outside We Met storage.                                     |
| `binding.consumer_send_email`, `binding.worker_assets`, `binding.worker_images`, `binding.worker_self_reference`                              | **n/a:** infrastructure bindings, not per-user stores.                                                                                                                                                        |
| `logs.worker_app`, `logs.worker_consumer`                                                                                                     | **Not purged:** Cloudflare Workers Observability; retention **vendor-dependent** (Workers Logs **7 days** on Paid per vendor docs; traces **unknown**).                                                       |
| `logs.cloudflare_email_sending_activity`                                                                                                      | **Not purged:** Cloudflare Email Service Activity log and `emailSendingAdaptive` metadata (from, to, subject, messageId, status; **31 days** per vendor docs in map). Operator cannot purge via this runbook. |
| `logs.cloudflare_email_sending_preview`                                                                                                       | **Not purged** when Email preview is on: full message bodies in Activity log Preview (~**7 days** per map); operator cannot purge via this runbook.                                                           |
| `auth.google_sign_in`                                                                                                                         | **Persisted fields tombstoned:** §7; OAuth tokens were not stored.                                                                                                                                            |
| `abuse.turnstile`, `abuse.client_ip_rate_limit`                                                                                               | **Not purged:** transit / edge processing; vendor retention **unknown**.                                                                                                                                      |
| `api.exchange_post_success_body`                                                                                                              | **Not persisted:** JSON `ownerEmail` and optional `ownerPhone` in POST `/api/exchange` success body only; visitor who completed step 1 in that tab. Account deletion does not clear visitor browsers.         |
| `api.exchange_vcard_response`                                                                                                                 | **Not persisted:** owner vCard streamed after valid exchange details token (`no-store`); visitor with token within TTL. Not deleted server-side.                                                              |
| `auth.google_contacts`                                                                                                                        | **D1 cleared:** §7 clears `contact_added_at` and `contact_sender_addresses`. **Google Contacts:** We Met contact row persists until the owner deletes it in Google; not controlled by this runbook.           |
| `binding.d1_we_met_db`                                                                                                                        | **n/a:** `WE_MET_DB` Wrangler binding; card-owner and visitor data in D1 table rows above, not in the binding itself.                                                                                         |
| `config.app_settings.visitor_email_mode`                                                                                                      | **n/a:** global `app_settings` feature flag (`owner_relay` or `direct`); not per-account personal data.                                                                                                       |
| `cookie.session`, `cookie.oauth_state`                                                                                                        | **Session ended:** §1; browser cookies cleared on logout/expiry at client.                                                                                                                                    |
| `browser.details_exchange_token`                                                                                                              | **Not server-stored:** 2 h TTL in visitor browser only.                                                                                                                                                       |
| `browser.local_storage_exchange_completed`                                                                                                    | **Visitor device:** per-slug `we-met-hi-exchange-completed:<slug>` in localStorage; reload fallback when sessionStorage is missing; user clears site data.                                                    |
| `browser.local_storage_theme`, `browser.local_storage_chips_opened`, `browser.local_storage_details_sent`                                     | **Visitor device:** not deleted by operator; user clears site data.                                                                                                                                           |
| `browser.local_storage_app_theme`                                                                                                             | **Card-owner device:** same; not deleted server-side.                                                                                                                                                         |

## Related

- [activating-an-account](./activating-an-account.md) (inverse for waitlist)
- [sign-out-everywhere](./sign-out-everywhere.md) (sessions only)
- [privacy-breach.md](./privacy-breach.md) (security incidents — not erasure)
- ADR [0025 §7](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)
