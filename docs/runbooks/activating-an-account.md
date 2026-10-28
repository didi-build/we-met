# Activating an account (waitlist)

**Purpose:** Allow a specific Google user to use the editor when **`signups_open`** is off. Used at MVP cutover: maintainer signs in (creates a **waitlisted** row), is activated by SQL, publishes `didi`, then sign-ups open ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md) §7).

**Schema check:** `accounts.status` enum from `migrations/0004_mvp_accounts_additive.sql`; `signups_open` in `app_settings` seeded in `migrations/0005_cards_rebuild_mvp.sql` (checked **2026-10-16**).

**D1 access:** [Running SQL against D1](./d1-operator-sql.md).

## Waitlist behavior

When `signups_open` is `0` / false / missing:

- New Google users insert as **`waitlisted`** (`src/app-auth/accounts.ts`).
- They receive a session with **`allowed: false`**; `/api/app/*` card routes return **403** `forbidden`.
- Turning **`signups_open` on** does **not** retroactively activate waitlisted users unless they sign in again (waitlisted → active on next login when sign-ups are open).

## Activate on staging (GitHub Actions)

When **`signups_open`** is off on shared non-prod D1, a first Google sign-in on **`https://we-met.didi.build`** creates a **waitlisted** account. To activate without laptop Wrangler:

1. Open the repo on GitHub: **Actions** → **Activate staging account**.
2. Choose **Run workflow**, branch **`main`**, enter the Google account **email** (lowercase in D1), then **Run workflow**.
3. The run uses the **`staging`** environment and **`CLOUDFLARE_API_TOKEN_STAGING`**. It validates the email (ASCII only, no punycode **`xn--`** domains), refuses Wrangler configs with **`env`** or **`previews`** blocks, and requires exactly one **`WE_MET_DB`** binding whose **`database_name`** is **`we-met-db-nonprod`** and whose **`database_id`** equals the GitHub **`WE_MET_D1_DATABASE_ID_NONPROD`** secret injected at run time. Then it runs the activation **`UPDATE`** against that database only.
4. Ask the user to refresh the editor or call `GET /api/app/session` so the client sees `allowed: true`.

If the run fails, the log shows one of these messages (no email is printed):

| Message                                                                   | Meaning                                                                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Staging account activation failed: account not found or not waitlisted.` | No matching row, or the account is not in `waitlisted` / `active` status.                     |
| `Staging account activation failed: multiple accounts matched.`           | The `UPDATE` changed more than one row (unexpected duplicate emails).                         |
| `Staging account activation failed: could not verify activation result.`  | Wrangler returned no usable JSON, or `success` was not true.                                  |
| `Staging account activation failed: database command error (exit N).`     | Wrangler exited non-zero (`N` is the exit code only; no wrangler stdout or stderr is logged). |

Other `Activation email rejected:` or `D1 database guard failed:` lines mean the input or Wrangler config failed checks before any `UPDATE`.

**Safety:** The workflow is **`workflow_dispatch` on `main` only** (no `pull_request` or `push` triggers). Do not run it from unmerged PR branch code.

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
