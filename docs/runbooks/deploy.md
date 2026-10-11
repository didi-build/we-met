# Deploy runbook

**Purpose:** Ship We Met to the right environment with the correct bindings.

## Preconditions

- CI green on the commit you deploy (`npm run check` on PRs).
- Architecture/decision docs updated if bindings or seams changed.
- Deploy must satisfy [deploy-time guards](../architecture/environments.md#deploy-time-guards) (`scripts/check-deploy-guards.mjs` in CI and `npm run deploy:guards` locally).

## Preview (per pull request)

- **Workflow:** [Preview](../../.github/workflows/preview.yml) (`name: Preview`).
- **Trigger:** `pull_request` opened, synchronized, or reopened (not from forks; skipped when the actor is Dependabot). Uses GitHub environment **`preview`** (no required reviewers).
- **Touches:** Preview instance on **`we-met`** (non-prod bindings in `previews` block); shared **`we-met-db-nonprod`** (see [0019](../decisions/0019-pr-preview-github-action.md)); `we-met-assets-nonprod`; `we-met-followup-email-nonprod`; separate **`we-met-followup-email-consumer-nonprod`**; rate limiter namespace **2001**; Turnstile widget **we-met nonprod** (`WE_MET_TURNSTILE_SITE_KEY_NONPROD` at build time); lead sink dispatcher (no implementations in step 1); mail redirect hardwired in the non-prod consumer.
- **D1 migrations:** The preview workflow does **not** apply migrations. Before opening a PR that adds a migration, run `npm run db:migrate:remote` against the shared non-prod database and keep migrations backward compatible (expand/contract) because other previews and the previous production deploy share that schema.
- **Find the URL:** GitHub PR comment from `github-actions[bot]` (“Cloudflare Preview: …”), or Cloudflare dashboard → Workers & Pages → **we-met** → Previews → `pr-<number>`.
- **Cleanup:** Closing the PR runs the `cleanup` job in the same workflow (`wrangler preview delete --name pr-<number>`); delete is tolerant of “preview not found”.
- **Verify:** Open the preview URL, load `/` (placeholder until the card ships). Full exchange smoke: [test-leads.md](./test-leads.md) after [DIDI-575](https://linear.app/didi-build/issue/DIDI-575) / [DIDI-577](https://linear.app/didi-build/issue/DIDI-577).

## Production (merge to `main` + approval)

- **Workflow:** [Deploy production](../../.github/workflows/deploy-production.yml) (`name: Deploy production`).
- **Trigger:** Push to `main` (docs-only paths ignored) or `workflow_dispatch`. The job uses the GitHub **`production`** environment and **waits for a required reviewer** before running.
- **Who:** Users with approval on the `production` environment.
- **Order:** Substitute D1 IDs → deploy-time guards → require production Turnstile site key → OpenNext build → **production D1 migrations** → `opennextjs-cloudflare deploy` (with `wrangler.ci.jsonc`).
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

# Dry-run with generated wrangler.ci.jsonc (dummy D1 UUIDs)
npm run worker:dry-run:generated
```

Proof deploys before first CI run: [deploy-setup.md](./deploy-setup.md) (maintainer `wrangler login` first, then CI tokens).

## GitHub configuration

CI Cloudflare tokens use **Workers Editor** scoped to Worker **`we-met`** ([0017](../decisions/0017-cloudflare-api-credentials.md)): `we-met-ci-nonprod` → `CLOUDFLARE_API_TOKEN_NONPROD`; `we-met-ci-production` → `CLOUDFLARE_API_TOKEN_PRODUCTION` plus **D1 Edit** for production migrations. No zone permissions after the proof deploy attaches `we-met.link`. Add permissions only when a 403 names them.

| Name                                   | Where                             | Used by                                          |
| -------------------------------------- | --------------------------------- | ------------------------------------------------ |
| `CLOUDFLARE_ACCOUNT_ID`                | Repository secret                 | Preview and production workflows                 |
| `CLOUDFLARE_API_TOKEN_NONPROD`         | `preview` environment secret      | Preview workflow                                 |
| `WE_MET_D1_DATABASE_ID_NONPROD`        | `preview` environment variable    | Preview workflow, `db:migrate:remote` (local)    |
| `WE_MET_TURNSTILE_SITE_KEY_NONPROD`    | `preview` environment variable    | Preview build                                    |
| `CLOUDFLARE_API_TOKEN_PRODUCTION`      | `production` environment secret   | Production deploy only                           |
| `WE_MET_D1_DATABASE_ID_PRODUCTION`     | `production` environment variable | Production deploy (`prepare` needs only this D1) |
| `WE_MET_TURNSTILE_SITE_KEY_PRODUCTION` | `production` environment variable | Production build                                 |

Worker secrets (`WE_MET_TOKEN_SECRET`, `TURNSTILE_SECRET_KEY`): set during the maintainer proof deploy in [deploy-setup.md](./deploy-setup.md) (`wrangler login`, then `wrangler secret put` / `wrangler preview base-config secret put`).

## Verification

- Health: `https://we-met.link/` loads over HTTPS (placeholder landing page until cutover content ships).
- Pipeline: controlled form submit in preview after exchange API and consumer land ([test-leads.md](./test-leads.md)).

## Logs

- **App Worker:** Cloudflare dashboard → Workers & Pages → **we-met** → Logs (production) or select Preview `pr-<n>`.
- **Queues:** Workers & Pages → Queues → `we-met-followup-email` / `we-met-followup-email-nonprod`.
- **Consumers:** Workers **we-met-followup-email-consumer** / **we-met-followup-email-consumer-nonprod** ([DIDI-577](https://linear.app/didi-build/issue/DIDI-577)).
- **GitHub:** Actions runs for workflows **Preview** and **Deploy production**.
