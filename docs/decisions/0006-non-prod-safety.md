# 0006. Non-prod safety: shared queue, mail redirect, Cloudflare Previews

- **Status:** accepted
- **Date:** 2026-10-11
- **Updates:** [0009](./0009-environments-local-preview-production.md), [0018](./0018-lead-sink.md)

## Context

Preview and local runs exercise real code paths that enqueue email. Step 1 uses a **no-op LeadSink** ([0018](./0018-lead-sink.md)), so non-prod does not create CRM records yet. Mistakes must not email real people.

## Decision

- **Preview** and **local** (when using remote bindings) share one **non-prod queue** (`we-met-followup-email-nonprod`) and **non-prod consumer** (`we-met-followup-email-consumer-nonprod`).
- The non-prod consumer **redirects all outbound mail** to **`WE_MET_TEST_MAIL_TO`**.
- **Lead sink in step 1:** cards use **`kind: "none"`**; no Linear (or other) lead records are created in preview or production until the Linear sink implementation merges **before cutover**.
- **When a Linear sink exists:** non-prod cards that point at Linear must use the **one shared test project**. Non-prod **`LINEAR_LEAD_LABEL_ID`** is the `we-met-test-lead` label ID. Title prefix **`[we-met-test]`** and **`WE_MET_ENV`** in the description are set in the Linear sink implementation (see [test-leads.md](../runbooks/test-leads.md)).
- PR environments use **Cloudflare Previews** on Worker **`we-met`** (non-prod bindings in the `previews` block). **Version URLs** share the Worker’s own resources and are not used for PR testing; previews isolate per PR.

## Reasons

- One non-prod pipeline is cheaper to operate and matches how previews are exercised.
- Mail redirect is a hard safety net even if card data points at real addresses.
- Deferring Linear keeps step 1 Worker secrets and deploy guards simpler until the sink lands.

## Consequences

- Deploy guards must block production bindings on preview builds ([environments.md](../architecture/environments.md)).
- Operators use the test-leads runbook after manual E2E tests **once** a Linear sink is enabled.
