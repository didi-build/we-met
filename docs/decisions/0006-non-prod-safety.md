# 0006. Non-prod safety: shared queue, mail redirect, test leads, Cloudflare Previews

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Preview and staging run real code paths that enqueue email and create Linear issues. Mistakes must not email real people or pollute production CRM.

## Decision

- **Preview** and **staging** share one **non-prod queue** (`we-met-followup-email-nonprod`) and **non-prod consumer** (`we-met-followup-email-consumer-nonprod`).
- The non-prod consumer **redirects all outbound mail** to **`WE_MET_TEST_MAIL_TO`**.
- All non-prod Linear leads go to the **one shared test project**, marked with label **`we-met-test-lead`**, title prefix **`[we-met-test]`**, and **`WE_MET_ENV`** in the issue description (see [test-leads.md](../runbooks/test-leads.md)).
- PR environments use **Cloudflare Previews** (including workers.dev preview hostnames). **Version URLs** share the Worker’s own resources and are not used for PR testing; previews isolate per PR.

## Reasons

- One non-prod pipeline is cheaper to operate and matches how previews and staging are exercised.
- Mail redirect is a hard safety net even if card data points at real addresses.
- Test lead marking makes cleanup in Linear obvious.

## Consequences

- Deploy guards must block production bindings on preview/staging builds ([environments.md](../architecture/environments.md)).
- Operators use the test-leads runbook after manual E2E tests.
