# 0023. Owner email lead sink delivery in the follow-up consumer

- **Status:** accepted
- **Date:** 2026-10-15
- **Updates:** [0018](./0018-lead-sink.md), [0021](./0021-followup-email-consumer-worker.md), [0022](./0022-lead-delivery-ledger.md)

## Context

[DIDI-586](https://linear.app/didi-build/issue/DIDI-586) shipped the delivery ledger, per-sink queue messages, and the `email` sink kind. The follow-up consumer still treated sink messages as unsupported. [DIDI-600](https://linear.app/didi-build/issue/DIDI-600) delivers owner notification email for `sinkKind: "email"`.

## Decision

1. **Delivery pipe, not CRM.** No visitor PII in D1; the ledger stays metadata only ([0022](./0022-lead-delivery-ledger.md)).
2. **From:** all consumer outbound mail uses secret **`WE_MET_OWNER_FROM_EMAIL`** as the SMTP From address. Owner sink emails use display name **`We Met`**. Visitor follow-up keeps the card snapshot **`emailFromName`** as the display name and **`Reply-To`** = the card owner email from the snapshot (never hardcoded). JWT `sub` stays **`GMAIL_SENDER`** (delegated Gmail user); OAuth scope stays `gmail.send` only.
3. **No fallback:** missing or non-plain `WE_MET_OWNER_FROM_EMAIL` fails closed with `owner_from_email_missing` through the normal retry/final-failure path.
4. **Destination:** `to` from queue `sinkConfig` snapshot only; consumer D1 reads **`lead_delivery_ledger` only**; never log `to`.
5. **Non-prod safety:** production sends to `sinkConfig.to`; other `WE_MET_ENV` redirects to `WE_MET_TEST_MAIL_TO` (fail closed if unset). One function beside `resolveEmailRecipient`. Non-prod subjects/bodies use the existing `[we-met test → …]` prefix and **Test delivery** line naming the **sink destination** (not the visitor).
6. **Subjects:** record `New lead added: <name>`; append `Re: New lead added: <name>` — one builder with shared non-prod prefix so threading subjects match (replaces web `Details added:`).
7. **Details token v2** includes signed `visitorName`; **v2 only** (`TOKEN_VERSION` 2). Append queue `lead` is `{ leadId, name, email }` plus `detailsSubmittedAt` on the message (no fabricated `submittedAt` / phone / environment fields).
8. **Threading:** deterministic `Message-ID` values `<{leadId}.{sinkId}.record@{domain}>` and `.append@`, with `In-Reply-To` / `References` and Gmail `threadId` from the record row when record `status = sent`. Append still sends if record never sent (unthreaded). `{domain}` is the domain part of `WE_MET_OWNER_FROM_EMAIL`.
9. **Ledger (consumer):** `queued` → `sent` on success (record stores `gmail_message_id`, `gmail_thread_id`, `sent_at`); failed attempts update `attempt_count` and `next_attempt_at`; final failure sets `failed` + `error_code`. Updates are conditional `WHERE status = 'queued'`.
10. **Duplicate-send guard:** `sent` or `failed` → ack without send. Send succeeded but ledger update failed → log `ledger_update_failed`, ack. Missing row → log `ledger_row_missing`, ack.
11. **Failure rules** match `visitor_followup` (shared retry policy). Malformed known sink messages: log `leadId` only, best-effort ledger `failed`, ack. Unknown `type` or unsupported `sinkKind` → `UnsupportedQueueMessageError`.
12. **Handler registry:** `sinkKind` maps to handlers; new kinds do not change the dispatcher or card schema.

App queue messages carry **`sourceUrl`** (`absoluteUrl(baseUrl, "/hi/<slug>")` at dispatch). `EmailSender.send` returns Gmail `messageId` / `threadId` (null on parse failure after HTTP 200).

## Reasons

- Replaces `didi.build/hi` owner notification without storing leads in D1.
- Snapshots + ledger give idempotent delivery and visible failures.
- Deterministic Message-IDs enable threading with `gmail.send` only.

## Consequences

- Production email sinks may be enabled after this ships and migration `0002` is applied.
- Tokens issued as v1 around deploy fail until visitors re-exchange (~2 h TTL tradeoff).
- Update [environments.md](../architecture/environments.md), [deploy-setup.md](../runbooks/deploy-setup.md), [test-leads.md](../runbooks/test-leads.md), and `.env.example` / `.dev.vars.example` for `WE_MET_OWNER_FROM_EMAIL`.
