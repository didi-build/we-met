# 0018. LeadSink: per-card destination, no-op in step 1

- **Status:** accepted
- **Date:** 2026-10-11
- **Updates:** [0004](./0004-card-data-and-branding.md), [0010](./0010-card-data-d1-and-load-script.md)

## Context

The exchange pipeline must record leads somewhere, but **Linear is not part of step 1**. Cutover ([DIDI-566](https://linear.app/didi-build/issue/DIDI-566)) requires a real lead sink merged **before** go-live.

## Decision

- **`LeadSink` interface** (app-owned seam), with three operations:
  - **Record a lead** (exchange submit).
  - **Append details** (details step).
  - **Note an email failure** (consumer or app when follow-up mail cannot be sent).
- **Resolution:** build a sink instance **per card** from **lead destination** on the card record: a **`kind`** plus **non-secret config** (JSON). **Credentials** for a given implementation stay **Worker secrets** owned by that implementation, not on the card row.
- **Step 1:** only a **no-op sink** (`kind: "none"`) ships. It is used in **preview and production** until a **Linear** implementation lands in a follow-up ticket. The no-op **never fails**.
- **Errors:** any **real** sink failure fails the request with **500** so a lead is never silently lost. The exchange path records the lead **before** enqueue; if enqueue fails after a successful record, the handler returns **500** and calls **note an email failure** when the sink supports it.

## Reasons

- Per-card destination supports multi-tenant sinks later without hardcoding one CRM.
- No-op unblocks step 1 deploy and email testing without Linear credentials on the Worker.
- Fail-closed behavior matches the old Linear contract without binding step 1 to Linear.

## Consequences

- Card load data and D1 schema include lead destination ([0010](./0010-card-data-d1-and-load-script.md)).
- `LINEAR_*` env vars belong to the **Linear sink implementation** only ([environments.md](../architecture/environments.md)).
- [test-leads.md](../runbooks/test-leads.md) marking rules apply **after** the Linear sink exists.
