# 0018. Lead sinks: list per card, async dispatch, no implementations in step 1

- **Status:** accepted
- **Date:** 2026-10-11
- **Updates:** [0004](./0004-card-data-and-branding.md), [0010](./0010-card-data-d1-and-load-script.md), [0022](./0022-lead-delivery-ledger.md)

## Context

Card owners will send leads to **multiple destinations** (Linear, email, later Jira, Zapier, webhooks). Step 1 must model that in D1 and the pipeline **without** shipping working sinks. **Linear is not in step 1.** Auth for Linear is **per-user OAuth** and needs stored tokens — see [DIDI-586](https://linear.app/didi-build/issue/DIDI-586) for whether the **email sink** ships first (option A) or a minimal **`connections`** table and one-off connect flow land before the Linear sink (option B). Not Worker-level `LINEAR_API_KEY`.

## Decision

- Each card has a **list** of lead sinks (not a single destination field on `cards`).
- **`lead_sinks` table:** `id`, `card_id`, `kind`, `config` (JSON text), `enabled`, `created_at`, `updated_at`. One row per sink. No per-kind config tables.
- **`config`:** non-secret settings only, validated per **`kind`** on every read and write through the **card-data seam** (typed objects in app code; nothing outside the repo sees raw JSON). Examples: `email` → `{ "to": "…" }`; `linear` → `{ "projectId", "labelId", "connectionId" }`.
- **Credentials** never live in `config`. Auth uses **`connectionId`** referencing a future **`connections`** table (accounts / `app.we-met.link`). Do not design that table in step 1; document the reference only.
- Every **`kind`** implements the same **`LeadSink`** interface: **record lead**, **append details**, **note delivery failure**.
- **Dispatcher:** on exchange (and details where applicable), enqueue **one queue message per enabled sink** so each delivery has its own retries; **one failing sink never blocks or duplicates another**. The **visitor follow-up email** remains its **own** message, independent of lead sinks (owner notification becomes an **email** sink in step 2 — [DIDI-586](https://linear.app/didi-build/issue/DIDI-586)).
- **Step 1:** ship the table, interface, and dispatcher. **No sink implementations** and **no `"none"` kind**. A card with **zero enabled sinks** sends leads nowhere; **exchange still succeeds**.
- **Step 2:** **email** sink implementation ([DIDI-586](https://linear.app/didi-build/issue/DIDI-586)). **Linear** sink timing follows the option chosen in that ticket.
- **Delivery ledger and config at send time:** the app writes **`lead_delivery_ledger`** rows ([0022](./0022-lead-delivery-ledger.md)). Queue messages include a **`sinkConfig` snapshot**; the follow-up consumer reads destination addresses from the message, not from `lead_sinks` D1.

## Reasons

- A list model matches owner choice of multiple CRMs and channels.
- Async per-sink messages isolate failure and retry domains.
- Step 1 schema and dispatcher avoid a rewrite when step 2 sinks arrive.

## Consequences

- Remove any singular `lead_destination` fields from schema and docs ([0010](./0010-card-data-d1-and-load-script.md)).
- No `LEAD_NOTIFY_TO` or `LINEAR_*` Worker variables ([environments.md](../architecture/environments.md)).
- [test-leads.md](../runbooks/test-leads.md) applies when a **Linear** sink row exists and the Linear kind is implemented.
- **Open:** the details-step signed token must carry **per-sink** record references for append-details ([overview](../architecture/overview.md#open-questions)).
