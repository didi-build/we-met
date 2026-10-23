# Deploy runbook

**Purpose:** Ship We Met to the right environment with the correct bindings.

## Preconditions

- CI green on the commit you deploy (`npm run check` on PRs).
- Architecture/decision docs updated if bindings or seams changed.
- Deploy must satisfy [deploy-time guards](../architecture/environments.md#deploy-time-guards) (`scripts/check-deploy-guards.mjs` in CI and `npm run deploy:guards` locally).

## Privileged change flag (per pull request)

- **Workflow:** [Privileged change](../../.github/workflows/privileged-change.yml) (`name: Privileged change`).
- **Trigger:** `pull_request_target` (opened, reopened, synchronize, labeled, unlabeled). Runs from **`main`**; the PR cannot modify this workflow’s logic.
- **Fork PRs:** skipped (`head.repo` must equal this repository). Forks do not get the comment, label, or status check from this workflow.
- **What it does:** Lists changed files against trusted matchers in `scripts/lib/privileged-paths.mjs`, scans changed workflow files via the API, posts or updates a single PR comment (`<!-- we-met-privileged-change -->`), adds `privileged-change` while flagged, and sets commit status **`privileged-change`** (fails until a maintainer adds **`privileged-change-reviewed`** after review). New pushes after review remove `privileged-change-reviewed` and note that re-review is required.
- **Maintainer setup (once):** After this workflow has run at least once on `main`, mark the **`privileged-change`** status check as **required** on `main` (branch protection or ruleset). Enable GitHub notifications for PR comments so you see the warning.
- **Limitation:** This is a visible flag, not a cryptographic lock; anyone who can label the PR can add `privileged-change-reviewed`.

## Preview (per pull request)

- **Workflow:** [Preview](../../.github/workflows/preview.yml) (`name: Preview`).
- **Trigger:** `pull_request` opened, synchronized, or reopened (not from forks; skipped when the actor is Dependabot). Uses GitHub environment **`preview`** (no required reviewers).
- **Touches:** Preview instance on **`we-met`** (non-prod bindings in `previews` block); shared **`we-met-db-nonprod`** (see [0019](../decisions/0019-pr-preview-github-action.md)); `we-met-assets-nonprod`; `we-met-followup-email-nonprod`; separate **`we-met-followup-email-consumer-nonprod`**; rate limiter namespace **2001**; Turnstile widget **we-met nonprod** (`WE_MET_TURNSTILE_SITE_KEY_NONPROD` at build time); lead sink dispatcher (no implementations in step 1); mail redirect hardwired in the non-prod consumer.
- **Provision:** The preview workflow **does not** provision. It binds existing non-prod D1/R2 only. A PR that **adds** a new non-prod `database_name` or `bucket_name` will fail Preview with an error that names the missing resource and points at [**Provision non-prod resources (main)**](../../.github/workflows/provision-nonprod-main.yml) (merge first, then that main-only job creates the resource). Preview compares the PR’s declared non-prod names to **`main`**; it does not call the provisioner.
- **D1 migrations:** The preview workflow does **not** apply migrations. PRs that change `migrations/` start [**Migrate non-prod D1**](../../.github/workflows/migrate-nonprod.yml): the plan job prints SQL in the run summary; approve the **`migrate-nonprod`** environment to apply to `we-met-db-nonprod` (phone-friendly). Terminal fallback: `npm run db:migrate:remote`. Keep migrations backward compatible (expand/contract) because other previews and the previous production deploy share that schema. Closing a PR without merging leaves its expand-only migration applied in non-prod.
- **Migrate apply concurrency (UNVERIFIED):** The apply job uses concurrency group `migrate-nonprod-apply` with `cancel-in-progress: false`, so at most one pending job can queue. If two PRs request migrations at once, GitHub may let the second pending environment approval supersede the first’s pending approval while the first PR’s comment still shows **waiting**. Recovery: re-run the first PR’s migration via **`workflow_dispatch`** on `migrate-nonprod.yml` with that PR number. (Known GitHub behavior; not exercised in this repo.)
- **Find the URL:** GitHub PR comment from `github-actions[bot]` (“Cloudflare Preview: …”), or Cloudflare dashboard → Workers & Pages → **we-met** → Previews → `pr-<number>`. PRs that change files under `migrations/` get a D1 migration notice in that comment.
- **Cleanup:** Closing the PR runs the `cleanup` job in the same workflow (`wrangler preview delete --name pr-<number>`); delete is tolerant of “preview not found”.
- **Verify:** Open the preview URL, load `/` (placeholder until the card ships). Full exchange smoke: [test-leads.md](./test-leads.md) after [DIDI-575](https://linear.app/didi-build/issue/DIDI-575) / [DIDI-577](https://linear.app/didi-build/issue/DIDI-577).

## Production (merge to `main` + approval)

- **Workflow:** [Deploy production](../../.github/workflows/deploy-production.yml) (`name: Deploy production`).
- **Trigger:** Push to `main` (docs-only paths ignored) or `workflow_dispatch`.
- **Plan job (before approval):** A **`plan`** job runs first on every trigger. It has **no** GitHub environment, **no** secrets, and permissions **`contents: read`** plus **`deployments: read`** (new on this workflow). It writes a job summary and a `::warning::` banner on the Actions run page listing `migrations/*.sql` files this deploy brings in (file names, added vs changed, best-effort last-changed commit/PR, and full SQL). Expand-only lint from the shared non-prod workflow runs **for visibility only**; violations do not block the deploy. The gated `production` approval remains the gate. Plan steps use **`continue-on-error: true`** and step **`timeout-minutes`** (checkout **2**, setup-node **2**, `npm ci` **5**, plan script **5**) so script errors, setup step failures, and hung setup do not hold the approval screen for the job’s default timeout and should not skip **`deploy`** (**UNVERIFIED** on GitHub: failed steps with `continue-on-error` and job conclusion / `needs.plan` — not exercised in this repo yet). Failures handled inside the plan job are soft but loud: summary plus warning (never “no migrations”). Categories include **`github_unavailable`**, **`access_or_config`**, and **`bug`** (runtime errors inside `plan.ts`), plus **setup step failed** (checkout, setup-node, or `npm ci` before `plan.ts` runs) and **plan step crashed or timed out** (import/tsx/timeout before `main()` catches). A runner that never starts, or a job cancelled from outside GitHub’s step logic, can still skip **`deploy`** — the same dependence on runners as the **`deploy`** job itself. Checkout failure also gets a fixed-text inline fallback when the repo cannot be checked out. The summary states an honest limit: this is **git diff since the last successful production deployment**, not live D1 state (failed partial applies or hand-run SQL would not show; Wrangler still owns apply).
- **Baseline:** Newest GitHub **deployment** to environment **`production`** whose latest status is **`success`** (newer pending, in-progress, failed, or inactive deployments are skipped). If none exists, the plan lists every `migrations/*.sql` file at the deploy commit and says there was no previous successful production deployment.
- **Compare:** When a baseline exists, the plan compares baseline SHA → deploy commit via the GitHub compare API and keeps migration files with status **added**, **modified**, or **renamed** (removed files are not “in this deploy”). If history is not a clean ahead-only compare (rollback, diverged history, unreachable base) or the compare file list may be truncated (**UNVERIFIED:** GitHub documents a ~300-file cap), the plan falls back to listing **all** migrations at the deploy commit and states why.
- **Concurrent runs (UNVERIFIED):** The workflow uses run-level concurrency `deploy-production` with `cancel-in-progress: false`, so a second run likely **waits** until the first run finishes (or is rejected/fails) before its plan job starts; GitHub may also replace an older pending run with a newer one. Do not assume two plan jobs overlap while a deploy is still awaiting approval. When an earlier deploy was **rejected or failed**, the baseline stays at the last **success**, so a later run’s plan can still list migrations that were part of the failed attempt (cumulative vs last success).
- **Gated deploy job:** The **`deploy`** job `needs: plan`, uses the GitHub **`production`** environment, and **waits for a required reviewer** before running. The original **app** deploy steps (Turnstile build through `opennextjs-cloudflare deploy`) are unchanged; [DIDI-599](https://linear.app/didi-build/issue/DIDI-599) added consumer **prepare**, **guard**, and **`wrangler deploy`** steps — see **Order** below.
- **Who:** Users with approval on the `production` environment.
- **Order (deploy job):** Deploy-time guards on committed `wrangler.jsonc` and consumer config → **provision D1/R2 (create-if-missing, Cloudflare REST API)** → substitute app D1 IDs from `provision-d1-ids.json` and/or env vars → app deploy-time guards on `wrangler.ci.jsonc` → prepare production consumer config → consumer deploy-time guards → require production Turnstile site key → OpenNext build → **production D1 migrations** → `opennextjs-cloudflare deploy` (with `wrangler.ci.jsonc`) → **`wrangler deploy`** for **`we-met-followup-email-consumer`** (with `wrangler.production.ci.jsonc`). **First time only:** hand-deploy the production consumer and set consumer mail secrets before creating **`we-met-ci-consumer-production`** and approving CI — see [deploy-setup.md](./deploy-setup.md#production-follow-up-email-consumer-first-deploy-didi-599).
- **Touches:** Worker **`we-met`** on **`we-met.link`**; `we-met-db`; `we-met-assets`; `we-met-followup-email`; **`we-met-followup-email-consumer`**; rate limiter namespace **2002**; Turnstile widget **we-met production**; visitor follow-up mail via Cloudflare Email Service (consumer [DIDI-577](https://linear.app/didi-build/issue/DIDI-577)).
- **Failure mode:** If the app deploy succeeds but the **consumer** deploy fails, production **`we-met`** stays on the new version while the follow-up queue may still lack a healthy consumer. Recovery: fix the failure and **re-run the full Deploy production job** (still requires `production` approval); the job re-runs app migrations, app deploy, and consumer deploy together.
- **Manual re-run:** Actions → **Deploy production** → Re-run failed jobs (still requires `production` approval when the environment is used).

## Non-prod follow-up email consumer (merge to `main`, no approval)

- **Workflow:** [Deploy consumer non-prod](../../.github/workflows/deploy-consumer-nonprod.yml) (`name: Deploy consumer non-prod`).
- **Trigger:** Push to **`main`** (every push; no path filter, because the consumer bundles shared email code) or **`workflow_dispatch`** on **`main`** only (GitHub environment **Deployment branches** restrict secrets to `main`; the job also checks `github.ref == 'refs/heads/main'`).
- **Ordering vs CI:** Uses a direct **`push`** to `main`, same pattern as **Deploy production** (not `workflow_run` after CI). PRs still gate changes with `npm run check`; this workflow ships the non-prod consumer without waiting for the CI workflow on the same push.
- **Environment:** GitHub **`consumer-nonprod`** (no required reviewers). **`WE_MET_D1_DATABASE_ID_PRODUCTION` is never set** in this job.
- **Steps:** `npm ci` → prepare `wrangler.nonprod.ci.jsonc` → `npm run deploy:guards` → consumer deploy-time guards on the generated config → `npm run worker:consumer-dry-run:nonprod` → `wrangler secret list` (names only; fails if `WE_MET_EMAIL_FROM_CLOUDFLARE`, `WE_MET_FROM_DISPLAY_NAME`, or `WE_MET_TEST_MAIL_TO` is missing) → `wrangler deploy` with commit SHA in **`--message`** and **`--tag`**. Does **not** run `wrangler secret put`.
- **Touches:** Worker **`we-met-followup-email-consumer-nonprod`**; queue **`we-met-followup-email-nonprod`**; shared non-prod D1 and R2 bindings per `workers/we-met-followup-email-consumer/wrangler.nonprod.jsonc`.
- **Concurrency:** Run-level group `deploy-consumer-nonprod` with `cancel-in-progress: false` (at most one deploy at a time; does not cancel an in-progress run).
- **Failure mode:** The job fails loudly; fix the error and use **Run workflow** (`workflow_dispatch`) on **`main`** to deploy the current `main` commit — do **not** use **Re-run** on an old Actions run, because a re-run redeploys that run’s original commit, not the latest `main`. Or use the [manual fallback](./deploy-setup.md#non-prod-follow-up-email-consumer-ci-default-manual-fallback).
- **Manual fallback:** Operator `wrangler login` steps in [deploy-setup.md](./deploy-setup.md#non-prod-follow-up-email-consumer-ci-default-manual-fallback) (for example deploying a PR branch consumer to non-prod).

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

Card data load (local / remote non-prod / production): [card-loading.md](./card-loading.md).

Proof deploys before first CI run: [deploy-setup.md](./deploy-setup.md) (maintainer `wrangler login` first, then CI tokens).

## Add a D1 database or R2 bucket (PR only)

1. In **`wrangler.jsonc`**, add a **production** binding at the top level (`database_name` / `bucket_name` without `-nonprod`) and a matching **previews** binding with the **same binding name** and a resource name of `<production-name>-nonprod`. Use a new placeholder `database_id` in the committed file (see existing `00000000-…0001` / `…0002` pattern in [0020](../decisions/0020-d1-database-id-injection.md)).
2. If the follow-up consumer needs the database or bucket, mirror the same names in `workers/we-met-followup-email-consumer/wrangler.production.jsonc` and `wrangler.nonprod.jsonc`.
3. Add a **`migrations/`** directory on the D1 binding when the resource is a database.
4. For **D1**, primary bindings keep `WE_MET_D1_DATABASE_ID_PRODUCTION` and `WE_MET_D1_DATABASE_ID_NONPROD` as optional overrides. Provision on **`main`** writes ids to gitignored `provision-d1-ids.json` (never logged). Additional databases use `WE_MET_D1_DATABASE_ID_<SLUG>_PRODUCTION` or `_NONPROD` per [0020 amendment](../decisions/0020-d1-database-id-injection.md#amendment-2026-10-23-didi-683-create-if-missing-d1r2-and-env-validation). You must also extend **`prepare-wrangler-config.mjs`** with a new placeholder for each extra database.
5. Update **`docs/privacy/data-map.yml`** when the binding stores personal data ([DIDI-651](https://linear.app/didi-build/issue/DIDI-651)).
6. **Order:** Open the PR (Preview may **fail** until step 7 — expected for new resource names). **Merge to `main`.** [**Provision non-prod resources (main)**](../../.github/workflows/provision-nonprod-main.yml) runs on wrangler config pushes (and `workflow_dispatch`) with `migrate-nonprod` secrets and creates missing **non-prod** D1/R2 from **`main`**. **`migrate-nonprod`** apply still provisions before migrations when `migrations/` changes. **Preview** on later PRs (or a re-run after merge + provision) binds the new non-prod resources. **Production** D1/R2 are created on the next approved [**Deploy production**](../../.github/workflows/deploy-production.yml) job. Preview never provisions. No dashboard or CLI create step by hand.

**Provisioner tokens (UNVERIFIED scopes on this repo):** only workflows on **`main`**-branch code may provision. **`CLOUDFLARE_API_TOKEN_PRODUCTION`** (`production` environment) for prod D1/R2; **`CLOUDFLARE_API_TOKEN_MIGRATE_NONPROD`** (`migrate-nonprod` environment) for non-prod D1/R2. Each needs account-level **D1 Edit** and **R2 Edit** per [DIDI-757](https://linear.app/didi-build/issue/DIDI-757). **`CLOUDFLARE_API_TOKEN_NONPROD`** (`preview`) must **not** receive D1/R2 Edit; preview never runs provision.

## GitHub configuration

CI Cloudflare tokens use **Workers Editor** on specific Workers ([0017](../decisions/0017-cloudflare-api-credentials.md)): `we-met-ci-nonprod` → `CLOUDFLARE_API_TOKEN_NONPROD` (**Editor** on **`we-met`** only; no zone policy; **no** D1/R2 Edit; preview deploy only). `we-met-ci-production` → `CLOUDFLARE_API_TOKEN_PRODUCTION` (**Editor** on **`we-met`**, account-level **D1 Edit** for production migrations and provision, **R2 Edit** required for provision per DIDI-757, plus zone **`we-met.link`** policy — **Workers Routes Write** + **Zone Read**, verified **2026-10-11** for zone). `we-met-ci-migrate-nonprod` → `CLOUDFLARE_API_TOKEN_MIGRATE_NONPROD` (**D1 Edit** and **R2 Edit** required for non-prod provision, UNVERIFIED). `we-met-ci-consumer-production` → `CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION` (**Editor** on **`we-met-followup-email-consumer`** only, plus account-level **Queues Edit** — verified **2026-10-14**). `we-met-ci-consumer-nonprod` → `CLOUDFLARE_API_TOKEN_CONSUMER_NONPROD` (**Editor** on **`we-met-followup-email-consumer-nonprod`** only, plus account-level **Queues Edit**). Add further permissions only when a 403 names them (except **Queues Edit** on the consumer tokens, which is required up front).

**Troubleshooting:** `The zone "we-met.link" does not exist on your account [code: 10084]` during production deploy means the CI token lacks zone access on `we-met.link`; see [0017](../decisions/0017-cloudflare-api-credentials.md#token-scoping-cloudflare-2026).

| Name                                       | Where                                                                        | Used by                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`                    | Repository secret                                                            | Preview, consumer non-prod, and production workflows                                  |
| `CLOUDFLARE_API_TOKEN_NONPROD`             | `preview` environment secret                                                 | Preview workflow                                                                      |
| `CLOUDFLARE_API_TOKEN_MIGRATE_NONPROD`     | `migrate-nonprod` environment secret                                         | Migrate non-prod D1 workflow (D1 only; names only here)                               |
| `WE_MET_D1_DATABASE_ID_NONPROD`            | `preview`, `migrate-nonprod`, and `consumer-nonprod` environment **secrets** | Preview, migrate, and non-prod consumer workflows; `db:migrate:remote` (local export) |
| `WE_MET_TURNSTILE_SITE_KEY_NONPROD`        | `preview` environment variable                                               | Preview build                                                                         |
| `CLOUDFLARE_API_TOKEN_PRODUCTION`          | `production` environment secret                                              | Production app deploy and D1 migrations only                                          |
| `CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION` | `production` environment secret                                              | Production follow-up email consumer deploy only                                       |
| `CLOUDFLARE_API_TOKEN_CONSUMER_NONPROD`    | `consumer-nonprod` environment secret                                        | Non-prod follow-up email consumer deploy only                                         |
| `WE_MET_D1_DATABASE_ID_PRODUCTION`         | `production` environment **secret**                                          | Production deploy (provision override / prepare cross-check)                          |
| `WE_MET_TURNSTILE_SITE_KEY_PRODUCTION`     | `production` environment variable                                            | Production build                                                                      |

Worker secrets (`WE_MET_TOKEN_SECRET`, `TURNSTILE_SECRET_KEY`): set during the maintainer proof deploy in [deploy-setup.md](./deploy-setup.md) (`wrangler login`, then `wrangler secret put` / `wrangler preview base-config secret put`).

## Verification

- Health: `https://we-met.link/` loads over HTTPS (placeholder landing page until cutover content ships).
- Pipeline: controlled form submit in preview after exchange API and consumer land ([test-leads.md](./test-leads.md)).

## Logs

- **App Worker:** Cloudflare dashboard → Workers & Pages → **we-met** → Logs (production) or select Preview `pr-<n>`.
- **Queues:** Workers & Pages → Queues → `we-met-followup-email` / `we-met-followup-email-nonprod`.
- **Consumers:** Workers **we-met-followup-email-consumer** / **we-met-followup-email-consumer-nonprod** ([DIDI-577](https://linear.app/didi-build/issue/DIDI-577)).
- **GitHub:** Actions runs for workflows **Preview**, **Deploy consumer non-prod**, and **Deploy production**.
