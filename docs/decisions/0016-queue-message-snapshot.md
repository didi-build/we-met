# 0016. Queue messages carry a card snapshot; consumer send path has no D1 reads

- **Status:** accepted
- **Date:** 2026-10-11
- **Updates:** 2026-10-15 (DIDI-599) — consumer may bind D1 for a future metadata-only ledger; send path unchanged

## Context

The follow-up email consumer runs as a separate Worker. Visitor follow-up mail must not depend on live card rows or duplicate lookup logic at send time.

## Decision

- Each **visitor follow-up email** queue message includes a **snapshot** of the card text fields that email needs, plus the **photo key** (step 1 sends only visitor follow-up mail from this consumer).
- **Send-time behavior** uses the queue snapshot and **read-only** R2 (`WE_MET_ASSETS`, `get` only). The consumer does **not** read visitor name, email, or phone from D1.
- The consumer Worker may bind **`WE_MET_DB`** (non-prod or production database per environment) for a **future metadata-only delivery ledger** ([DIDI-586](https://linear.app/didi-build/issue/DIDI-586)). Step 1 / DIDI-599 add the binding only; **no consumer code queries D1** yet.

## Reasons

- Snapshots make send-time behavior independent of later card edits or DB outages.
- Read-only R2 on the consumer limits blast radius if the consumer is misconfigured.
- A D1 binding reserved for ledger metadata keeps delivery observability separate from CRM-style PII storage.

## Consequences

- Producers must enqueue complete email field snapshots ([DIDI-574](https://linear.app/didi-build/issue/DIDI-574)).
- Consumer Wrangler config binds environment R2 bucket and `WE_MET_DB` (placeholder `database_id` in git; real ID at deploy via [0020](./0020-d1-database-id-injection.md)).
