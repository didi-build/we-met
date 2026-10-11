# Deploy runbook

**Purpose:** Ship We Met to the right environment with the correct bindings.

## Preconditions

- CI green on the commit you deploy (`npm run check` on PRs).
- Architecture/decision docs updated if bindings or seams changed.
- Deploy must satisfy [deploy-time guards](../architecture/environments.md#deploy-time-guards): every `previews` binding is non-prod; preview never binds production queue, consumer, rate limiter, D1, R2, or Linear project; non-prod `LINEAR_PROJECT_ID` is the shared test project; non-prod mail redirect stays enabled; production requires the GitHub `production` environment.

## Preview (per pull request)

- **Trigger:** [DIDI-572](https://linear.app/didi-build/issue/DIDI-572) chooses Cloudflare Git integration vs a GitHub Action. Forks do not get deploy access.
- **Touches:** Preview instance on **`we-met`** (non-prod bindings in `previews` block); `we-met-followup-email-nonprod`; separate **`we-met-followup-email-consumer-nonprod`**; `we-met-db-nonprod`; `we-met-assets-nonprod`; non-prod rate limiter; always-pass Turnstile test pair; shared Linear test project; mail redirect hardwired in the non-prod consumer.
- **Verify:** Open the preview URL, load `/hi/didi`, submit a test exchange; confirm test lead in Linear ([test-leads.md](./test-leads.md)). Links in redirected test emails use `WE_MET_BASE_URL` (`https://we-met.link`) by design.

## Production (merge to `main` + approval)

- **Trigger:** Merge to **`main`** starts the production deploy workflow; the job **waits for approval** on the GitHub **`production`** environment ([0007](../decisions/0007-production-deploy-manual.md)). This includes Dependabot merges.
- **Who:** Only users with approval on the `production` environment.
- **Touches:** Worker **`we-met`**; `we-met-db` (migrations first); `we-met-assets`; `we-met-followup-email`; `we-met-followup-email-consumer`; production rate limiter namespace; real Turnstile keys; production Linear project; real mail via Gmail API.
- **Command:** Added by [DIDI-572](https://linear.app/didi-build/issue/DIDI-572) (e.g. `npm run deploy:production` or workflow name documented there).

## Verification

- Health: card page loads on the environment host (preview URL or `we-met.link`).
- Pipeline: one controlled form submit on a **preview** before approving production for the same commit.

## Logs

- Cloudflare Workers / queue consumer logs for the matching `we-met-*` worker names ([DIDI-572](https://linear.app/didi-build/issue/DIDI-572) documents dashboard links).
