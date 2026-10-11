# 0006. Non-prod safety: shared queue, mail redirect, Cloudflare Previews

- **Status:** accepted
- **Date:** 2026-10-11
- **Updates:** [0009](./0009-environments-local-preview-production.md), [0018](./0018-lead-sink.md)

## Context

Preview and local runs exercise real code paths that enqueue email. **Step 1** has **no lead sink implementations** — only schema and dispatch ([0018](./0018-lead-sink.md)). Mistakes must not email real people.

## Decision

- **Preview** and **local** (when using remote bindings) share one **non-prod queue** (`we-met-followup-email-nonprod`) and **non-prod consumer** (`we-met-followup-email-consumer-nonprod`).
- The non-prod consumer **redirects all outbound mail** to **`WE_MET_TEST_MAIL_TO`**.
- **Lead sinks in step 1:** `lead_sinks` rows may exist, but **no sink kinds are implemented**; dispatch enqueues nothing for sinks until step 2. Cards with zero enabled sinks behave the same.
- **When Linear (and other) sinks exist (step 2+):** non-prod test cards should use test projects and marking documented in [test-leads.md](../runbooks/test-leads.md). Linear auth uses **per-user OAuth** via `connectionId`, not Worker secrets.
- PR environments use **Cloudflare Previews** on Worker **`we-met`** (non-prod bindings in the `previews` block). **Version URLs** share the Worker’s own resources and are not used for PR testing; previews isolate per PR.

## Reasons

- One non-prod pipeline is cheaper to operate and matches how previews are exercised.
- Mail redirect is a hard safety net even if card data points at real addresses.
- Deferring sink implementations keeps step 1 deploys free of CRM credentials.

## Consequences

- Deploy guards must block production bindings on preview builds ([environments.md](../architecture/environments.md)).
- Operators use the test-leads runbook after manual E2E tests **once** sink implementations are enabled on test cards.
