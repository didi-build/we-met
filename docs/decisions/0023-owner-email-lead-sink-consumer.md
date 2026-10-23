# 0023. Owner email lead sink delivery in the follow-up consumer

- **Status:** accepted
- **Date:** 2026-10-15
- **Updates:** [0018](./0018-lead-sink.md), [0021](./0021-followup-email-consumer-worker.md), [0022](./0022-lead-delivery-ledger.md), [0024](./0024-sink-agnostic-record-append-correlation.md) (2026-10-15). **Extended by [0025](./0025-we-met-mvp-accounts-sign-in-and-app-backend.md) phase 4:** consumer reads `lead_email_enabled` and drops queued sink mail with `lead_email_paused`; visitor follow-up is acked without send when paused. **Extended by [0027](./0027-owner-relay-visitor-follow-up.md) (2026-10-22):** `visitor_email_mode` defaults to `owner_relay`; exchange skips visitor follow-up enqueue; consumer acks queued `visitor_followup` without send when mode is `owner_relay` (`visitor_followup_skipped_owner_relay`). **Amended 2026-10-17 ([DIDI-642](https://linear.app/didi-build/issue/DIDI-642)):** visitor follow-up **From** display name is `{Google first name} via We Met` when the first name passes validation, otherwise the platform name from `WE_MET_FROM_DISPLAY_NAME`; owner sink mail keeps the platform name only. **Amended 2026-10-18 ([DIDI-653](https://linear.app/didi-build/issue/DIDI-653)) (superseded 2026-10-23):** outbound mail may use **Gmail** (default) or **Cloudflare Email Service** (`app_settings.email_provider`). Gmail keeps **`WE_MET_OWNER_FROM_EMAIL`** (`hello@we-met.link`). Cloudflare uses secret **`WE_MET_EMAIL_FROM_CLOUDFLARE`** (`hello@mail.we-met.link`). Display name rules are unchanged. Gmail OAuth **`GMAIL_SENDER`** / `gmail.send` stays for the Gmail path only. **Amended 2026-10-23 ([DIDI-795](https://linear.app/didi-build/issue/DIDI-795)):** supersedes the 2026-10-18 DIDI-653 amendment; see [Amendment (2026-10-23, DIDI-795)](#amendment-2026-10-23-didi-795-cloudflare-only-outbound-email) below.

## Context

[DIDI-586](https://linear.app/didi-build/issue/DIDI-586) shipped the delivery ledger, per-sink queue messages, and the `email` sink kind. The follow-up consumer still treated sink messages as unsupported. [DIDI-600](https://linear.app/didi-build/issue/DIDI-600) delivers owner notification email for `sinkKind: "email"`.

## Decision

1. **Delivery pipe, not CRM.** No visitor PII in D1; the ledger stays metadata only ([0022](./0022-lead-delivery-ledger.md)).
2. **From:** consumer outbound mail uses **Cloudflare Email Service** via the Worker **`EMAIL`** binding (`send_email`). Visible **From** address comes from secret **`WE_MET_EMAIL_FROM_CLOUDFLARE`** (`hello@mail.we-met.link`). **Owner** sink mail uses secret **`WE_MET_FROM_DISPLAY_NAME`** as the visible display name. **Visitor** follow-up uses `{Google first name} via We Met` when the Google given name passes validation (`resolveVisitorFromDisplayName`); otherwise it uses **`WE_MET_FROM_DISPLAY_NAME`** unchanged (same fail-closed rules if that secret is missing or invalid). The card snapshot **`emailFromName`** is **not** used for the From display name; owners cannot type the visitor From name on the card. **`Reply-To`** = the card owner email from the snapshot (never hardcoded).
3. **No fallback:** missing or invalid `WE_MET_FROM_DISPLAY_NAME` fails closed with `from_display_name_missing` through the normal retry/final-failure path.
4. **No fallback:** missing or non-plain `WE_MET_EMAIL_FROM_CLOUDFLARE` fails closed with `cloudflare_from_email_missing` through the normal retry/final-failure path.
5. **Destination:** `to` from queue `sinkConfig` snapshot only; consumer D1 reads **`lead_delivery_ledger`** and **`app_settings`** (`lead_email_enabled` only); never log `to`. When `lead_email_enabled` is off, drop queued sink work: mark the ledger row `failed` with `lead_email_paused`, send nothing, ack without retry. Visitor follow-up messages are acked without send. Daily caps are enforced at submission only ([0025](./0025-we-met-mvp-accounts-sign-in-and-app-backend.md) phase 4).
6. **Non-prod safety:** production sends to `sinkConfig.to`; other `WE_MET_ENV` redirects to `WE_MET_TEST_MAIL_TO` (fail closed if unset). One function beside `resolveEmailRecipient`. Non-prod subjects/bodies use the existing `[we-met test → …]` prefix and **Test delivery** line naming the **sink destination** (not the visitor).
7. **Subjects:** record `New lead added: <name>`; append `Re: New lead added: <name>` — one builder with shared non-prod prefix so threading subjects match (replaces web `Details added:`).
8. **Details token v2** includes signed `visitorName`; **v2 only** (`TOKEN_VERSION` 2). Append queue `lead` is `{ leadId, name, email }` plus `detailsSubmittedAt` on the message (no fabricated `submittedAt` / phone / environment fields).
9. **Threading:** append sets `In-Reply-To` / `References` from the record row’s **`external_ref`** when record delivery succeeded (`messageId` from Cloudflare Email Service). Append still sends if record never sent (unthreaded). Historical Gmail-era sends used deterministic `Message-ID` values and Gmail `threadId` in **`external_ref`** ([DIDI-601](https://linear.app/didi-build/issue/DIDI-601)); that path is retired ([DIDI-795](https://linear.app/didi-build/issue/DIDI-795)).
10. **Ledger (consumer):** shared lifecycle in `process-lead-sink.ts` ([0024](./0024-sink-agnostic-record-append-correlation.md)): `queued` → `sent` on success (stores opaque **`external_ref`**, `sent_at`); failed attempts update `attempt_count` and `next_attempt_at`; final failure sets `failed` + `error_code`. Email handlers do not touch the ledger. Updates are conditional `WHERE status = 'queued'`.
11. **Duplicate-send guard:** `sent` or `failed` → ack without send. Send succeeded but ledger update failed → log `ledger_update_failed`, ack. Missing row → log `ledger_row_missing`, ack.
12. **Failure rules** match `visitor_followup` (shared retry policy). Malformed known sink messages: log `leadId` only, best-effort ledger `failed`, ack. Unknown `type` or unsupported `sinkKind` → `UnsupportedQueueMessageError`.
13. **Handler registry:** `sinkKind` maps to handlers; new kinds do not change the dispatcher or card schema.

App queue messages carry **`sourceUrl`** (`absoluteUrl(baseUrl, "/hi/<slug>")` at dispatch). The email sender returns the Cloudflare Email Service **`messageId`** for ledger **`external_ref`** (see [0024](./0024-sink-agnostic-record-append-correlation.md)).

## Reasons

- Replaces `didi.build/hi` owner notification without storing leads in D1.
- Snapshots + ledger give idempotent delivery and visible failures.
- Record/append correlation uses opaque **`external_ref`** ([0024](./0024-sink-agnostic-record-append-correlation.md)).

## Consequences

- Production email sinks may be enabled after this ships and migration `0002` is applied.
- Tokens issued as v1 around deploy fail until visitors re-exchange (~2 h TTL tradeoff).
- Update [environments.md](../architecture/environments.md), [deploy-setup.md](../runbooks/deploy-setup.md), [test-leads.md](../runbooks/test-leads.md), and `.env.example` / `.dev.vars.example` for `WE_MET_OWNER_FROM_EMAIL` and `WE_MET_FROM_DISPLAY_NAME`. Outbound From is now **`WE_MET_EMAIL_FROM_CLOUDFLARE`** only; see [Amendment (2026-10-23, DIDI-795)](#amendment-2026-10-23-didi-795-cloudflare-only-outbound-email).

## Amendment (2026-10-23, DIDI-795): Cloudflare-only outbound email

Supersedes the **2026-10-18** [DIDI-653](https://linear.app/didi-build/issue/DIDI-653) amendment (dual Gmail / Cloudflare provider switch). Older amendment text above is kept for history only.

**Outbound mail:** only **Cloudflare Email Service**, via the follow-up consumer Worker **`EMAIL`** binding (`send_email`).

**From address:** secret **`WE_MET_EMAIL_FROM_CLOUDFLARE`** (for example `hello@mail.we-met.link`). Display name rules from [DIDI-642](https://linear.app/didi-build/issue/DIDI-642) are unchanged.

**Removed from code:** Gmail API sender, `app_settings.email_provider` switch, and related `gmail_*` consumer error codes. Worker secret names **`GMAIL_SERVICE_ACCOUNT_JSON`**, **`GMAIL_SENDER`**, and **`WE_MET_OWNER_FROM_EMAIL`** are deleted from Wrangler and the Google service account key is revoked in [DIDI-799](https://linear.app/didi-build/issue/DIDI-799) (secrets may still appear in `wrangler secret list` until then).

**Ledger columns (with [0022](./0022-lead-delivery-ledger.md)):** `lead_delivery_ledger.gmail_message_id` and `gmail_thread_id` remain **legacy, unused** schema columns. No consumer code writes them. Per CTO D1 query on **2026-10-23**, production has **zero** non-null values in both columns and non-prod has **six** non-null rows (Gmail-era tests). Dropping them needs a destructive migration and maintainer approval, and buys nothing now. Revisit only if the table is rebuilt for another reason.
