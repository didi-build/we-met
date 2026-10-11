# Deploy runbook

**Purpose:** Ship We Met to the right environment with the correct bindings.

## Preconditions

- CI green on the commit you deploy (`npm run check` on PRs).
- Architecture/decision docs updated if bindings or seams changed.
- Deploy must satisfy [deploy-time guards](../architecture/environments.md#deploy-time-guards): every `previews` binding is non-prod; preview never binds production queue, consumer, rate limiter, D1, or R2; non-prod mail redirect stays enabled; production requires the GitHub `production` environment.

## Preview (per pull request)

- **Workflow:** [Preview](../../.github/workflows/preview.yml) (`name: Preview`).
- **Trigger:** `pull_request` opened, synchronized, or reopened (not from forks).
- **Touches:** Preview instance on **`we-met`** (non-prod bindings in `previews` block); `we-met-db-nonprod`; `we-met-assets-nonprod`; `we-met-followup-email-nonprod`; separate **`we-met-followup-email-consumer-nonprod`**; rate limiter namespace **2001**; Turnstile widget **we-met nonprod** (`WE_MET_TURNSTILE_SITE_KEY_NONPROD` at build time); lead sink dispatcher (no implementations in step 1); mail redirect hardwired in the non-prod consumer.
- **Find the URL:** GitHub PR comment from `github-actions[bot]` (“Cloudflare Preview: …”), or Cloudflare dashboard → Workers & Pages → **we-met** → Previews → `pr-<number>`.
- **Cleanup:** Closing the PR runs the `cleanup` job in the same workflow (`wrangler preview delete --name pr-<number>`).
- **Verify:** Open the preview URL, load `/` (placeholder until the card ships). Full exchange smoke: [test-leads.md](./test-leads.md) after [DIDI-575](https://linear.app/didi-build/issue/DIDI-575) / [DIDI-577](https://linear.app/didi-build/issue/DIDI-577).

## Production (merge to `main` + approval)

- **Workflow:** [Deploy production](../../.github/workflows/deploy-production.yml) (`name: Deploy production`).
- **Trigger:** Push to `main` (including Dependabot merges). The job uses the GitHub **`production`** environment and **waits for a required reviewer** before running.
- **Who:** Users with approval on the `production` environment.
- **Order:** Substitute D1 IDs → deploy-time guards → **production D1 migrations** → OpenNext build (production Turnstile site key) → `opennextjs-cloudflare deploy`.
- **Touches:** Worker **`we-met`** on **`we-met.link`**; `we-met-db`; `we-met-assets`; `we-met-followup-email`; `we-met-followup-email-consumer`; rate limiter namespace **2002**; Turnstile widget **we-met production**; visitor follow-up mail via Gmail API (consumer [DIDI-577](https://linear.app/didi-build/issue/DIDI-577)).
- **Manual re-run:** Actions → **Deploy production** → Re-run failed jobs (still requires `production` approval when the environment is used).

## Local / operator commands

```bash
npm run check
npm run deploy:guards

# Remote non-prod D1 only (requires WE_MET_D1_DATABASE_ID_NONPROD)
npm run db:migrate:remote

# Dry-run Worker bundle (placeholder D1 IDs in committed wrangler.jsonc)
npm run worker:dry-run
```

Proof deploys before first CI run: [didi-572-account-steps.md](./didi-572-account-steps.md).

## GitHub configuration

| Name                                   | Where                                               | Used by                                          |
| -------------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`                 | Repository secret (non-prod-scoped)                 | Preview workflow                                 |
| `CLOUDFLARE_ACCOUNT_ID`                | Repository secret                                   | Preview workflow                                 |
| `CLOUDFLARE_API_TOKEN`                 | `production` environment secret                     | Production deploy                                |
| `CLOUDFLARE_ACCOUNT_ID`                | `production` environment secret (if not repo-level) | Production deploy                                |
| `WE_MET_D1_DATABASE_ID_NONPROD`        | Repository variable                                 | Preview, `db:migrate:remote`, production prepare |
| `WE_MET_D1_DATABASE_ID_PRODUCTION`     | `production` environment variable                   | Production deploy                                |
| `WE_MET_TURNSTILE_SITE_KEY_NONPROD`    | Repository variable                                 | Preview build                                    |
| `WE_MET_TURNSTILE_SITE_KEY_PRODUCTION` | `production` environment variable                   | Production build                                 |

Worker secrets (`WE_MET_TOKEN_SECRET`, `TURNSTILE_SECRET_KEY`): **Previews base** (non-prod values) via `wrangler preview base-config secret put …`; production Worker via `wrangler secret put …` (production token). See [0017](../decisions/0017-cloudflare-api-credentials.md).

## Verification

- Health: `https://we-met.link/` loads over HTTPS (placeholder landing page until cutover content ships).
- Pipeline: controlled form submit in preview after exchange API and consumer land ([test-leads.md](./test-leads.md)).

## Logs

- **App Worker:** Cloudflare dashboard → Workers & Pages → **we-met** → Logs (production) or select Preview `pr-<n>`.
- **Queues:** Workers & Pages → Queues → `we-met-followup-email` / `we-met-followup-email-nonprod`.
- **Consumers:** Workers **we-met-followup-email-consumer** / **we-met-followup-email-consumer-nonprod** ([DIDI-577](https://linear.app/didi-build/issue/DIDI-577)).
- **GitHub:** Actions runs for workflows **Preview** and **Deploy production**.
