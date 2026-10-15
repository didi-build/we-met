# 0022. Lead delivery ledger (metadata only) and queue snapshot config

- **Status:** accepted
- **Date:** 2026-10-15
- **Updates:** [0018](./0018-lead-sink.md), [0016](./0016-queue-message-snapshot.md), [0024](./0024-sink-agnostic-record-append-correlation.md) (2026-10-15)

## Context

Lead sink delivery is async (one queue message per sink). Operators need delivery status without storing visitor PII in D1 ([DIDI-586](https://linear.app/didi-build/issue/DIDI-586)). The follow-up email consumer must not read `lead_sinks` at runtime if D1 access is limited to the ledger.

## Decision

- **`lead_delivery_ledger` table** (migration `0002_lead_delivery_ledger.sql`, extended by `0003_lead_delivery_ledger_external_ref.sql`): metadata only — `lead_id`, `card_id`, `sink_id`, `sink_kind`, `phase` (`record` | `append`), `status`, `error_code`, retry fields, timestamps, optional **`external_ref`** (opaque sink correlation ids; [0024](./0024-sink-agnostic-record-append-correlation.md)). Legacy `gmail_message_id` / `gmail_thread_id` columns remain but are **deprecated** (consumer writes `external_ref` only). **No** visitor name, email, phone, message body, or destination address. **`UNIQUE (lead_id, sink_id, phase)`**.
- **Exchange (app Worker):** for each enabled sink, insert `phase=record` row (`queued`) **before** enqueueing `lead_sink_record`; on enqueue failure mark `failed` with `enqueue_failed`. Visitor follow-up path unchanged.
- **Details (app Worker):** insert `phase=append` if absent; skip enqueue when row already exists (any status). Duplicate HTTP submit returns **200** `{ ok: true }` without extra mail.
- **`retry_until`:** enqueue time plus **`FOLLOWUP_RETRY_RETENTION_BUDGET_SECONDS`** from `scripts/lib/queue-retry-policy.mjs` (shared with consumer retry guards).
- **Sink destination:** carried on the queue message as **`sinkConfig` snapshot** at dispatch time ([0016](./0016-queue-message-snapshot.md)). The consumer does **not** read `lead_sinks` from D1; consumer D1 use in a later PR is **ledger only**.

## Reasons

- Ledger gives idempotency and failure visibility without a CRM-style store.
- Queue snapshots avoid stale `to` if a row changes mid-flight and keep consumer D1 scoped to the ledger.
- Shared retry budget constant stays aligned with queue retention guards.

## Consequences

- Production must apply migration `0002` before app code that writes the ledger ships.
- **Do not** enable email sinks in production until the consumer implements sink delivery ([DIDI-586](https://linear.app/didi-build/issue/DIDI-586) PR4); until then sink messages retry as unsupported types.
