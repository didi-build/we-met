# 0027. Owner relay for visitor follow-up email (`visitor_email_mode`)

- **Status:** accepted
- **Date:** 2026-10-22 (approved by Diadem)
- **Updates:** [0023](./0023-owner-email-lead-sink-consumer.md), [0025](./0025-we-met-mvp-accounts-sign-in-and-app-backend.md) phase 4 caps, [DIDI-656](https://linear.app/didi-build/issue/DIDI-656) (cold `mail.we-met.link` deliverability). **Amended 2026-10-24 ([DIDI-820](https://linear.app/didi-build/issue/DIDI-820)):** `visitor_email_mode` only picks who receives the visitor letter; both modes send the letter and the owner relay email (two sends per exchange).

## Context

Visitor follow-up email is sent from a cold subdomain (`mail.we-met.link` via Cloudflare Email Service). That path hurts deliverability and can spam visitors who only wanted to share contact details with the card owner. Owner notification email (lead sink) is the primary product outcome at exchange time.

## Decision

1. **`app_settings.visitor_email_mode`** controls **who receives the visitor letter** (the "Great meeting you" email with vCard). It does **not** disable the letter.
2. **Values:** `owner_relay` (default) or `direct` (exact match, lowercase only).
3. **Default:** missing, empty, unknown, or mixed-case values resolve to **`owner_relay`** (`visitorEmailModeFromSettingValue` in `src/app-settings/defaults.ts`). Only the trimmed string **`direct`** sends the letter to the visitor. No migration: absent key means owner relay.
4. **`owner_relay`:** the visitor letter goes to the **owner** (Reply-To the visitor, vCard attached). The **owner relay** email ("You met …") also goes to the owner with full details. Daily caps reserve **two** slots per exchange (letter + owner email).
5. **`direct`:** the visitor letter goes to the **visitor** (From/Reply-To as before). The owner relay email is unchanged from `owner_relay`.
6. **Owner sink** always uses `buildOwnerRelayEmail` regardless of mode ([DIDI-745](https://linear.app/didi-build/issue/DIDI-745), [DIDI-820](https://linear.app/didi-build/issue/DIDI-820)).

## Reasons

- Stop cold-subdomain mail to visitors by default while keeping owner notification and a shareable letter the owner can forward.
- Fail closed toward **not** emailing visitors when the setting is missing or mistyped.
- Keep `direct` available for rollback and non-prod experiments without code deploy.

## Consequences

- Production uses owner relay unless operators set `visitor_email_mode` to `direct` in D1 (see [kill-switch-and-caps](../runbooks/kill-switch-and-caps.md)).
- Daily cap math for exchange counts **two** enqueue slots per exchange in both modes.
- Visitor follow-up templates and consumer send path remain; relay mode changes recipient and Reply-To only.

## Switching back to direct visitor email

```sql
INSERT INTO app_settings (key, value) VALUES ('visitor_email_mode', 'direct')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
```

Revert to owner relay:

```sql
INSERT INTO app_settings (key, value) VALUES ('visitor_email_mode', 'owner_relay')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
```

Or delete the row; missing key defaults to `owner_relay`.

## Migration 0009 rollout and rollback (DIDI-820)

**Migration:** `0009_exchange_owner_email_visitor_letter.sql` adds `visitor_letter_claimed_at` and `visitor_letter_sent_at` on `exchange_owner_email`. Apply on non-prod before production ship; production migrations run as the first step of the approved production deploy ([0011](./0011-d1-migrations.md)).

**Rollout order (production):** matches [deploy-production.yml](../../.github/workflows/deploy-production.yml): apply migration 0009, deploy the **app** Worker (enqueues `visitor_letter_due` on exchange and immediate `visitor_followup` on finalize), then deploy the follow-up **consumer** (letter claims and `visitor_letter_sent_at`). The **app-to-consumer gap** is only the minutes between those deploy steps; it is separate from the **2-hour** details token TTL (`TOKEN_TTL_SECONDS` in `src/exchange/token.ts`), which bounds how long a visitor may still finalize after exchange.

Between app and consumer deploy, the **old** consumer still runs. In **`owner_relay`**, it **acks** immediate `visitor_followup` without sending (`visitor_followup_skipped_owner_relay`). Only exchanges **started after** the new app is live enqueue **`visitor_letter_due`**; the old consumer treats that type as **unsupported** and **retries** until Cloudflare discards it, so those fallbacks are **not** delivered until the new consumer is live. For such an exchange, if the visitor finalizes during the gap, the immediate `visitor_followup` is acked without send and delivery waits on **`visitor_letter_due`** once the new consumer is up (delayed enqueue plus consumer retry/defer, up to **30 minutes** while details finalize is in flight). For an exchange **started before** the new app deployed, the old app never enqueued **`visitor_letter_due`**; if the visitor finalizes only during the app-to-consumer gap, the new app enqueues immediate `visitor_followup` but the old consumer still acks without send, so **no** visitor letter is sent at all. That **loss** is limited to finalizes in that gap.

**`visitor_email_mode` in production:** the value lives in D1 `app_settings`, not Wrangler. Code defaults to **`owner_relay`** when the row is missing (`visitorEmailModeFromSettingValue`). **UNVERIFIED:** whether production D1 has an explicit row (no production query in repo docs).

**Code rollback (app or consumer):** redeploy the previous Worker build. The rolled-back app stops enqueueing `visitor_letter_due`. The **pre-0009** consumer never acks `visitor_letter_due`; it retries as unsupported until Cloudflare drops the message, so those letters are **not** sent after rollback. The old consumer still **acks** immediate `visitor_followup` without sending in **`owner_relay`**. Rows in `exchange_owner_email` keep the new columns (harmless when old code ignores them).

**Deploy-window note (direct mode):** applies only when production **`visitor_email_mode`** is **`direct`**. **Direct-mode** duplicate-letter risk applies to (1) pre-DIDI-820 exchanges that enqueued **`visitor_followup`** on exchange (the old consumer sent that letter but **did not** write `visitor_letter_sent_at`) while the visitor may still finalize for up to **2 hours** (token TTL), and (2) exchanges during the DIDI-820 rollout window. For (2), two paths: **(a)** Exchange **after** the app deploy and **finalized before** the new consumer is live: the old consumer sends the immediate letter without recording **`visitor_letter_sent_at`**, then the new consumer sends the **`visitor_letter_due`** fallback after up to **30 minutes** deferral, so the visitor may get a **second** letter. **(b)** Exchange **before** the app deploy and **finalized** in the app-to-consumer gap: the old consumer sends **twice** itself, first the old app's letter at **exchange** time (direct enqueued **`visitor_followup`** on exchange), then the new app's immediate **`visitor_followup`** at finalize (the old finalize path did not enqueue visitor mail). Post-820 **`exchange_visitor_letter_skipped_prior_send`** only helps when **`visitor_letter_sent_at`** was set by the **new** consumer. **Mitigation** (operator step, only if production uses **`direct`**): set **`visitor_email_mode`** to **`owner_relay`** before the app deploy and restore after the consumer is live; during that window the letter goes to the **owner** instead of the visitor. See [kill-switch-and-caps](../runbooks/kill-switch-and-caps.md) for flipping the mode and flipping it back.
