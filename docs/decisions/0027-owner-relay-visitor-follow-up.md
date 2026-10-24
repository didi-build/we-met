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

**Rollout order (production):** matches [deploy-production.yml](../../.github/workflows/deploy-production.yml): apply migration 0009, deploy the **app** Worker (enqueues `visitor_letter_due` and immediate `visitor_followup` on finalize), then deploy the follow-up **consumer** (letter claims and `visitor_letter_sent_at`). Between app and consumer deploy, the **old** consumer still runs: it **acks** immediate `visitor_followup` without sending in **`owner_relay`** (legacy `visitor_followup_skipped_owner_relay`), so the letter is deferred to **`visitor_letter_due`** fallback (up to about 10 minutes, then consumer retry/defer windows). A `visitor_letter_due` message that reaches the old consumer is treated as an **unsupported** queue type and **retries** until Cloudflare discards it; those fallbacks are **not** delivered until the new consumer is live.

**`visitor_email_mode` in production:** the value lives in D1 `app_settings`, not Wrangler. Code defaults to **`owner_relay`** when the row is missing (`visitorEmailModeFromSettingValue`). **UNVERIFIED:** whether production D1 has an explicit row (no production query in repo docs).

**Code rollback (app or consumer):** redeploy the previous Worker build. The rolled-back app stops enqueueing `visitor_letter_due`. The **pre-0009** consumer never acks `visitor_letter_due`; it retries as unsupported until Cloudflare drops the message, so those letters are **not** sent after rollback. The old consumer still **acks** immediate `visitor_followup` without sending in **`owner_relay`**. Rows in `exchange_owner_email` keep the new columns (harmless when old code ignores them).

**Deploy-window note (direct mode):** pre-DIDI-820 **direct** exchanges enqueued `visitor_followup` on exchange. The old consumer sent that letter but **did not** write `visitor_letter_sent_at`. A finalize after DIDI-820 can enqueue another `visitor_followup`; the new consumer has **no** durable record of the first send, so a **duplicate visitor letter** can still happen. Post-820 `visitor_letter_skipped_prior_send` only helps when `visitor_letter_sent_at` was set by the **new** consumer (for example after a successful claim on `visitor_letter_due` or immediate `visitor_followup`). Mitigation: deploy the **new consumer before the app** on non-prod rehearsal; for production, accept the brief cross-version risk or pause direct-mode exchanges during the cutover window.
