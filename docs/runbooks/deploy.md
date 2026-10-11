# Deploy runbook

**Purpose:** Ship We Met to the right environment with the correct bindings.

## Preconditions

- CI green on the commit you deploy (`npm run check` on PRs).
- Architecture/decision docs updated if bindings or seams changed.
- Deploy must satisfy [deploy-time guards](../architecture/environments.md#deploy-time-guards): non-prod never binds production queue, consumer, or rate limiter; non-prod `LINEAR_PROJECT_ID` is the shared test project; non-prod mail redirect stays enabled; non-prod never targets Worker `we-met`; production requires the GitHub `production` environment.

## Preview (per pull request)

- **Trigger:** [DIDI-572](https://linear.app/didi-build/issue/DIDI-572) chooses Cloudflare Git integration vs a GitHub Action. Forks do not get deploy access.
- **Touches:** Preview instance on **`we-met-staging`**; `we-met-followup-email-nonprod`; separate **`we-met-followup-email-consumer-nonprod`**; non-prod rate limiter; always-pass Turnstile test pair; shared Linear test project; mail redirect hardwired in the non-prod consumer.
- **Verify:** Open the preview URL, load `/p/didi`, submit a test exchange; confirm test lead in Linear ([test-leads.md](./test-leads.md)).

## Staging (from `main`)

- **Trigger:** Merge to `main` deploys **`we-met-staging`** ([DIDI-572](https://linear.app/didi-build/issue/DIDI-572)).
- **Touches:** Same non-prod queue, consumer, and Linear test project as preview; **`we-met.didi.build`** with **real** Turnstile keys (mail still redirected via `WE_MET_TEST_MAIL_TO`).
- **Verify:** Smoke test on staging host; optional E2E per [test-leads.md](./test-leads.md).

## Production (manual)

- **Trigger:** Manual workflow dispatch on `main`, after **GitHub `production` environment** approval ([0007](../decisions/0007-production-deploy-manual.md)).
- **Who:** Only users with approval on the `production` environment.
- **Touches:** Worker **`we-met`** (when `we-met.link` is live); `we-met-followup-email`; `we-met-followup-email-consumer`; production rate limiter namespace; real Turnstile keys; production Linear project; real mail via Gmail API.
- **Command:** Added by [DIDI-572](https://linear.app/didi-build/issue/DIDI-572) (e.g. `npm run deploy:production` or workflow name documented there).

## Verification

- Health: card page loads on the environment host.
- Pipeline: one controlled form submit in non-prod before promoting the same commit to production.

## Logs

- Cloudflare Workers / queue consumer logs for the matching `we-met-*` worker names ([DIDI-572](https://linear.app/didi-build/issue/DIDI-572) documents dashboard links).
