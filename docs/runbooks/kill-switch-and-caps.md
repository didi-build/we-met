# Kill switch and daily caps

**Purpose:** Pause or throttle **lead email** (owner sink mail and visitor follow-up) without taking the site offline ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md) phase 4).

**Schema check:** `app_settings` and `daily_send_counts` from `migrations/0004_mvp_accounts_additive.sql`; ledger columns from `migrations/0002_lead_delivery_ledger.sql` (checked **2026-10-16**).

**D1 access:** [Running SQL against D1](./d1-operator-sql.md).

## Settings keys (`app_settings`)

| Key                  | Role                                                                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lead_email_enabled` | Kill switch. **On** only when the value is **`1`** or **`true`** (case-insensitive). **Missing or empty** defaults to **enabled**. Any other **non-empty** value (for example `0`, `false`, `off`) is treated as **off** (`leadEmailEnabledFromSettingValue` in `src/app-settings/defaults.ts`). |
| `daily_cap_global`   | Max **enqueue** slots per UTC day across all cards (owner + visitor kinds summed). Product default **150**.                                                                                                                                                                                      |
| `daily_cap_per_card` | Max **enqueue** slots per UTC day for one `card_id` (owner + visitor kinds summed). Product default **50**.                                                                                                                                                                                      |
| `email_provider`     | `gmail` (default) or `cloudflare` for the follow-up consumer ([DIDI-653](https://linear.app/didi-build/issue/DIDI-653)).                                                                                                                                                                         |
| `visitor_email_mode` | `owner_relay` (default) or `direct`. **Missing, empty, or unknown** values are **`owner_relay`**: exchange does not enqueue visitor follow-up; caps count owner only. **`direct`** restores visitor follow-up enqueue and send ([0027](../decisions/0027-owner-relay-visitor-follow-up.md)).     |

Missing, non-numeric, or non-positive cap values **fail closed** (same as kill switch off) — new submissions get **503** `lead_email_unavailable`.

### Launch values (product default)

Set at cutover (from [DIDI-631](https://linear.app/didi-build/issue/DIDI-631) / ADR 0025):

```sql
INSERT INTO app_settings (key, value) VALUES ('daily_cap_global', '150')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO app_settings (key, value) VALUES ('daily_cap_per_card', '50')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO app_settings (key, value) VALUES ('lead_email_enabled', '1')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
```

(`0005` seeds `lead_email_enabled` and `signups_open` when empty; caps are operator-set.)

## Email provider

Flip the follow-up consumer to Cloudflare Email Service:

```sql
INSERT INTO app_settings (key, value) VALUES ('email_provider', 'cloudflare')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
```

Rollback to Gmail:

```sql
INSERT INTO app_settings (key, value) VALUES ('email_provider', 'gmail')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
```

Read back:

```sql
SELECT key, value FROM app_settings WHERE key = 'email_provider';
```

Set `WE_MET_EMAIL_FROM_CLOUDFLARE` on the consumer **before** flipping to `cloudflare`; with provider `cloudflare` and that secret missing, sends fail closed and retry. A missing or unknown `email_provider` value means Gmail, so rollback takes effect on the next message.

`email_provider` is per environment (non-prod and production use separate D1 databases); run these statements against the database you intend to change.

## Visitor email mode (owner relay vs direct)

Production default is **owner relay** (no visitor follow-up email). To restore direct visitor follow-up:

```sql
INSERT INTO app_settings (key, value) VALUES ('visitor_email_mode', 'direct')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
```

Return to owner relay (or delete the row; missing defaults to `owner_relay`):

```sql
INSERT INTO app_settings (key, value) VALUES ('visitor_email_mode', 'owner_relay')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
```

Read back:

```sql
SELECT key, value FROM app_settings WHERE key = 'visitor_email_mode';
```

## Turn kill switch off

```sql
INSERT INTO app_settings (key, value) VALUES ('lead_email_enabled', '0')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
```

### New submissions

`POST /api/exchange` and `POST /api/details` return **503** with `{ "error": "lead_email_unavailable" }`. **No** `lead_delivery_ledger` row, queue message, or `daily_send_counts` change.

### Already queued mail

The follow-up consumer re-reads `lead_email_enabled`:

- **Email sink messages:** ledger row → `failed` with `error_code` **`lead_email_paused`**; message **acked** (no retry).
- **Visitor follow-up:** **acked** without send.

Caps are **not** re-checked in the consumer.

## Read usage (UTC day)

Today’s UTC date as `YYYY-MM-DD` (same as `utcDayFromDate` in `src/lead-email/daily-send-counts.ts`):

```sql
-- Global enqueue slots counted today
SELECT COALESCE(SUM(count), 0) AS global_used
FROM daily_send_counts
WHERE day = '<yyyy-mm-dd>';

-- Per card
SELECT kind, count
FROM daily_send_counts
WHERE day = '<yyyy-mm-dd>' AND card_id = '<card_id>';
```

**UNVERIFIED:** Counters measure **queued** owner/visitor sends at exchange/details time, not Gmail delivery success ([DIDI-631](https://linear.app/didi-build/issue/DIDI-631)).

## Read ledger (sink deliveries)

```sql
SELECT lead_id, card_id, sink_id, phase, status, error_code, created_at, updated_at
FROM lead_delivery_ledger
WHERE card_id = '<card_id>'
ORDER BY created_at DESC
LIMIT 50;
```

Visitor follow-up has **no** ledger row (**UNVERIFIED** gap documented in [environments.md](../architecture/environments.md#known-gaps-unverified)).

## Re-enable

```sql
INSERT INTO app_settings (key, value) VALUES ('lead_email_enabled', '1')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
```

Ensure both cap keys are positive integers before expecting exchange to succeed.

## Related

- [test-leads](./test-leads.md)
- ADR [0025 phase 4](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md#phase-4-implementation-notes-didi-617)
- Non-prod consumer staleness: [environments.md](../architecture/environments.md#known-gaps-unverified) ([DIDI-627](https://linear.app/didi-build/issue/DIDI-627))
