# 0016. Queue messages carry a card snapshot; consumer has no D1

- **Status:** accepted
- **Date:** 2026-10-11

## Context

The follow-up email consumer runs as a separate Worker. It should not need database access or duplicate lookup logic at send time.

## Decision

- Each queue message includes a **snapshot** of the card text fields the emails need, plus the **photo key**.
- The **consumer Worker has no D1 binding**; it reads the photo from R2 via a **read-only** `WE_MET_ASSETS` bucket binding.

## Reasons

- Snapshots make send-time behavior independent of later card edits or DB outages.
- Read-only R2 on the consumer limits blast radius if the consumer is misconfigured.

## Consequences

- Producers must enqueue complete email field snapshots ([DIDI-574](https://linear.app/didi-build/issue/DIDI-574)).
- Consumer Wrangler config binds non-prod or prod assets bucket only, not `WE_MET_DB`.
