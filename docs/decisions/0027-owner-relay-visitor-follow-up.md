# 0027. Owner relay for visitor follow-up email (`visitor_email_mode`)

- **Status:** accepted
- **Date:** 2026-10-22 (approved by Diadem)
- **Updates:** [0023](./0023-owner-email-lead-sink-consumer.md), [0025](./0025-we-met-mvp-accounts-sign-in-and-app-backend.md) phase 4 caps, [DIDI-656](https://linear.app/didi-build/issue/DIDI-656) (cold `mail.we-met.link` deliverability).

## Context

Visitor follow-up email is sent from a cold subdomain (`mail.we-met.link` via Cloudflare Email Service, or Gmail with platform From). That path hurts deliverability and can spam visitors who only wanted to share contact details with the card owner. Owner notification email (lead sink) is the primary product outcome at exchange time.

## Decision

1. **`app_settings.visitor_email_mode`** controls whether the app enqueues and the consumer sends **visitor follow-up** email.
2. **Values:** `owner_relay` (default) or `direct` (exact match, lowercase only).
3. **Default:** missing, empty, unknown, or mixed-case values resolve to **`owner_relay`** (`visitorEmailModeFromSettingValue` in `src/app-settings/defaults.ts`). Only the trimmed string **`direct`** enables visitor follow-up. No migration: absent key means owner relay.
4. **`owner_relay`:** exchange does **not** call `enqueueVisitorFollowup`; daily caps reserve **one** slot (owner sink only). Owner lead-sink dispatch and the details token are unchanged. The consumer **acks** any queued `visitor_followup` message without send and logs `visitor_followup_skipped_owner_relay` with `leadId` only.
5. **`direct`:** preserves pre-0027 behavior (visitor follow-up enqueued and sent when `lead_email_enabled` is on).
6. **Owner sink templates** may branch on `visitorEmailMode` in the email lead-sink handler context ([DIDI-745](https://linear.app/didi-build/issue/DIDI-745)); this ADR does not change templates.

## Reasons

- Stop cold-subdomain mail to visitors by default while keeping owner notification.
- Fail closed toward **not** emailing visitors when the setting is missing or mistyped.
- Keep `direct` available for rollback and non-prod experiments without code deploy.

## Consequences

- Production uses owner relay unless operators set `visitor_email_mode` to `direct` in D1 (see [kill-switch-and-caps](../runbooks/kill-switch-and-caps.md)).
- Daily cap math for exchange drops from two slots to one under owner relay.
- Visitor follow-up code and templates remain for `direct` mode.

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
