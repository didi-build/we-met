# 0023. Owner email lead sink delivery in the follow-up consumer

- **Status:** accepted
- **Date:** 2026-10-15
- **Updates:** [0018](./0018-lead-sink.md), [0021](./0021-followup-email-consumer-worker.md), [0022](./0022-lead-delivery-ledger.md), [0024](./0024-sink-agnostic-record-append-correlation.md) (2026-10-15). **Extended by [0025](./0025-we-met-mvp-accounts-sign-in-and-app-backend.md) phase 4:** consumer reads `lead_email_enabled` and drops queued sink mail with `lead_email_paused`; visitor follow-up is acked without send when paused. **Amended 2026-10-17 ([DIDI-642](https://linear.app/didi-build/issue/DIDI-642)):** visitor follow-up **From** display name is `{Google first name} via We Met` when the first name passes validation, otherwise the platform name from `WE_MET_FROM_DISPLAY_NAME`; owner sink mail keeps the platform name only.

## Context

[DIDI-586](https://linear.app/didi-build/issue/DIDI-586) shipped the delivery ledger, per-sink queue messages, and the `email` sink kind. The follow-up consumer still treated sink messages as unsupported. [DIDI-600](https://linear.app/didi-build/issue/DIDI-600) delivers owner notification email for `sinkKind: "email"`.

## Decision

1. **Delivery pipe, not CRM.** No visitor PII in D1; the ledger stays metadata only ([0022](./0022-lead-delivery-ledger.md)).
2. **From:** all consumer outbound mail uses secret **`WE_MET_OWNER_FROM_EMAIL`** as the SMTP From address. **Owner** sink mail uses secret **`WE_MET_FROM_DISPLAY_NAME`** as the visible display name. **Visitor** follow-up uses `{Google first name} via We Met` when the Google given name passes validation (`resolveVisitorFromDisplayName`); otherwise it uses **`WE_MET_FROM_DISPLAY_NAME`** unchanged (same fail-closed rules if that secret is missing or invalid). The card snapshot **`emailFromName`** is **not** used for the From display name; owners cannot type the visitor From name on the card. **`Reply-To`** = the card owner email from the snapshot (never hardcoded). JWT `sub` stays **`GMAIL_SENDER`** (delegated Gmail user); OAuth scope stays `gmail.send` only.
3. **No fallback:** missing or invalid `WE_MET_FROM_DISPLAY_NAME` fails closed with `from_display_name_missing` through the normal retry/final-failure path.
4. **No fallback:** missing or non-plain `WE_MET_OWNER_FROM_EMAIL` fails closed with `owner_from_email_missing` through the normal retry/final-failure path.
5. **Destination:** `to` from queue `sinkConfig` snapshot only; consumer D1 reads **`lead_delivery_ledger`** and **`app_settings`** (`lead_email_enabled` only); never log `to`. When `lead_email_enabled` is off, drop queued sink work: mark the ledger row `failed` with `lead_email_paused`, send nothing, ack without retry. Visitor follow-up messages are acked without send. Daily caps are enforced at submission only ([0025](./0025-we-met-mvp-accounts-sign-in-and-app-backend.md) phase 4).
6. **Non-prod safety:** production sends to `sinkConfig.to`; other `WE_MET_ENV` redirects to `WE_MET_TEST_MAIL_TO` (fail closed if unset). One function beside `resolveEmailRecipient`. Non-prod subjects/bodies use the existing `[we-met test → …]` prefix and **Test delivery** line naming the **sink destination** (not the visitor).
7. **Subjects:** record `New lead added: <name>`; append `Re: New lead added: <name>` — one builder with shared non-prod prefix so threading subjects match (replaces web `Details added:`).
8. **Details token v2** includes signed `visitorName`; **v2 only** (`TOKEN_VERSION` 2). Append queue `lead` is `{ leadId, name, email }` plus `detailsSubmittedAt` on the message (no fabricated `submittedAt` / phone / environment fields).
9. **Threading:** deterministic `Message-ID` values `<{leadId}.{sinkId}.record@{domain}>` and `.append@`, with `In-Reply-To` / `References` when the record delivery succeeded. Gmail may **rewrite** the custom `Message-ID` for the recipient (observed 2026-10-15, [DIDI-601](https://linear.app/didi-build/issue/DIDI-601)); sender-side Gmail `threadId` from the record’s **`external_ref`** still groups mail in the owner mailbox when record `status = sent`. Append still sends if record never sent (unthreaded). `{domain}` is the domain part of `WE_MET_OWNER_FROM_EMAIL`.
10. **Ledger (consumer):** shared lifecycle in `process-lead-sink.ts` ([0024](./0024-sink-agnostic-record-append-correlation.md)): `queued` → `sent` on success (stores opaque **`external_ref`**, `sent_at`); failed attempts update `attempt_count` and `next_attempt_at`; final failure sets `failed` + `error_code`. Email handlers do not touch the ledger. Updates are conditional `WHERE status = 'queued'`.
11. **Duplicate-send guard:** `sent` or `failed` → ack without send. Send succeeded but ledger update failed → log `ledger_update_failed`, ack. Missing row → log `ledger_row_missing`, ack.
12. **Failure rules** match `visitor_followup` (shared retry policy). Malformed known sink messages: log `leadId` only, best-effort ledger `failed`, ack. Unknown `type` or unsupported `sinkKind` → `UnsupportedQueueMessageError`.
13. **Handler registry:** `sinkKind` maps to handlers; new kinds do not change the dispatcher or card schema.

App queue messages carry **`sourceUrl`** (`absoluteUrl(baseUrl, "/hi/<slug>")` at dispatch). `EmailSender.send` returns Gmail `messageId` / `threadId` (null on parse failure after HTTP 200).

## Reasons

- Replaces `didi.build/hi` owner notification without storing leads in D1.
- Snapshots + ledger give idempotent delivery and visible failures.
- Deterministic Message-IDs enable threading with `gmail.send` only.

## Consequences

- Production email sinks may be enabled after this ships and migration `0002` is applied.
- Tokens issued as v1 around deploy fail until visitors re-exchange (~2 h TTL tradeoff).
- Update [environments.md](../architecture/environments.md), [deploy-setup.md](../runbooks/deploy-setup.md), [test-leads.md](../runbooks/test-leads.md), and `.env.example` / `.dev.vars.example` for `WE_MET_OWNER_FROM_EMAIL` and `WE_MET_FROM_DISPLAY_NAME`.
