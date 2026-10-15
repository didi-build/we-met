# 0024. Sink-agnostic record/append correlation (`external_ref`)

- **Status:** accepted
- **Date:** 2026-10-15
- **Updates:** [0018](./0018-lead-sink.md), [0022](./0022-lead-delivery-ledger.md), [0023](./0023-owner-email-lead-sink-consumer.md)

## Context

ADR 0018 requires every sink kind to implement record lead and append details. The first implementation stored Gmail-specific columns on `lead_delivery_ledger` and let the email handler own ledger updates. Other sinks (Linear, Slack) need the same “create once, append to the same object” behavior with sink-specific ids. [DIDI-601](https://linear.app/didi-build/issue/DIDI-601) showed Gmail rewrites custom `Message-ID` headers for recipients; sender-side `threadId` still helps the owner mailbox.

## Decision

1. **`deliverRecord` / `deliverAppend` handlers** are pure delivery: they do **not** read or write the ledger. The shared consumer path in `process-lead-sink.ts` owns the full ledger lifecycle for every sink kind.
2. **`externalRef`:** after a successful send, a handler may return an opaque JSON object string (flat object, values are string | number | boolean | null only, no nesting, max 1024 bytes, ids only — never personal data). Or `null`.
3. **Ledger column `external_ref`:** migration `0003_lead_delivery_ledger_external_ref.sql` adds `external_ref TEXT`. Consumer writes **`external_ref` only**; `gmail_message_id` / `gmail_thread_id` are **deprecated** (no longer written; dropped in a later migration).
4. **Append context:** `deliverAppend` receives `recordRef` — the record row’s `external_ref` parsed, or `null` when the record is unavailable and the handler allows it.
5. **`appendRequiresRecord`:** per handler flag. When `true`, append fails with `record_unavailable` if the record row is missing, `failed`, or still `queued` on the final queue attempt. When `false` (email), append still runs with `recordRef: null` (unthreaded).
6. **Append waits for record:** while the record row is `queued` and retries remain, append **defers** (`message.retry`, log `lead_sink_append_deferred`). Deferral is not a failure.
7. **Invalid `externalRef` after send:** log `ledger_update_failed` with `external_ref_invalid`, store `null`, **ack** (no resend).
8. **Email handler** stores `{ "gmailThreadId", "gmailMessageId" }` in `externalRef` and uses `recordRef.gmailThreadId` as Gmail `threadId` on append. Deterministic `Message-ID`, `In-Reply-To`, `References`, subjects, From, and templates stay unchanged ([0023](./0023-owner-email-lead-sink-consumer.md)).

## Reasons

- One correlation mechanism for all sink kinds without leaking sink details into shared SQL columns.
- Shared deferral and failure rules keep Linear/Slack append safe without duplicating ledger code per handler.
- Additive migration is safe while production ledger had no rows (observed 2026-10-15).

## Consequences

- Apply migration `0003` before consumer code that writes `external_ref` deploys.
- New sink kinds implement two deliver functions plus `appendRequiresRecord`; no ledger imports in handlers.
- Recipient-side email threading remains a separate experiment; this ADR is plumbing only.
