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
- **Order (deploy job):** Substitute app D1 IDs → app deploy-time guards → prepare production consumer config → consumer deploy-time guards → require production Turnstile site key → OpenNext build → **production D1 migrations** → `opennextjs-cloudflare deploy` (with `wrangler.ci.jsonc`) → **`wrangler deploy`** for **`we-met-followup-email-consumer`** (with `wrangler.production.ci.jsonc`). **First time only:** hand-deploy the production consumer and set Gmail secrets before creating **`we-met-ci-consumer-production`** and approving CI — see [deploy-setup.md](./deploy-setup.md#production-follow-up-email-consumer-first-deploy-didi-599).
- **Touches:** Worker **`we-met`** on **`we-met.link`**; `we-met-db`; `we-met-assets`; `we-met-followup-email`; **`we-met-followup-email-consumer`**; rate limiter namespace **2002**; Turnstile widget **we-met production**; visitor follow-up mail via Gmail API (consumer [DIDI-577](https://linear.app/didi-build/issue/DIDI-577)).
- **Failure mode:** If the app deploy succeeds but the **consumer** deploy fails, production **`we-met`** stays on the new version while the follow-up queue may still lack a healthy consumer. Recovery: fix the failure and **re-run the full Deploy production job** (still requires `production` approval); the job re-runs app migrations, app deploy, and consumer deploy together.
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

Card data load (local / remote non-prod / production): [card-loading.md](./card-loading.md).

Proof deploys before first CI run: [deploy-setup.md](./deploy-setup.md) (maintainer `wrangler login` first, then CI tokens).

## GitHub configuration

CI Cloudflare tokens use **Workers Editor** on specific Workers ([0017](../decisions/0017-cloudflare-api-credentials.md)): `we-met-ci-nonprod` → `CLOUDFLARE_API_TOKEN_NONPROD` (**Editor** on **`we-met`** only; no zone policy). `we-met-ci-production` → `CLOUDFLARE_API_TOKEN_PRODUCTION` (**Editor** on **`we-met`**, account-level **D1 Edit** for production migrations, plus zone **`we-met.link`** policy — **Workers Routes Write** + **Zone Read**, verified **2026-10-11**). `we-met-ci-consumer-production` → `CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION` (**Editor** on **`we-met-followup-email-consumer`** only, plus account-level **Queues Edit** — verified **2026-10-14**; first CI consumer deploy failed with `Authentication error [code: 10000]` on queue list until **Queues Edit** was added; D1 was not required). Add further permissions only when a 403 names them (except **Queues Edit** on the consumer token, which is required up front).

**Troubleshooting:** `The zone "we-met.link" does not exist on your account [code: 10084]` during production deploy means the CI token lacks zone access on `we-met.link`; see [0017](../decisions/0017-cloudflare-api-credentials.md#token-scoping-cloudflare-2026).

| Name                                       | Where                                                 | Used by                                                         |
| ------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`                    | Repository secret                                     | Preview and production workflows                                |
| `CLOUDFLARE_API_TOKEN_NONPROD`             | `preview` environment secret                          | Preview workflow                                                |
| `CLOUDFLARE_API_TOKEN_MIGRATE_NONPROD`     | `migrate-nonprod` environment secret                  | Migrate non-prod D1 workflow (D1 only; names only here)         |
| `WE_MET_D1_DATABASE_ID_NONPROD`            | `preview` and `migrate-nonprod` environment variables | Preview workflow, migrate workflow, `db:migrate:remote` (local) |
| `WE_MET_TURNSTILE_SITE_KEY_NONPROD`        | `preview` environment variable                        | Preview build                                                   |
| `CLOUDFLARE_API_TOKEN_PRODUCTION`          | `production` environment secret                       | Production app deploy and D1 migrations only                    |
| `CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION` | `production` environment secret                       | Production follow-up email consumer deploy only                 |
| `WE_MET_D1_DATABASE_ID_PRODUCTION`         | `production` environment variable                     | Production deploy (`prepare` needs only this D1)                |
| `WE_MET_TURNSTILE_SITE_KEY_PRODUCTION`     | `production` environment variable                     | Production build                                                |

Worker secrets (`WE_MET_TOKEN_SECRET`, `TURNSTILE_SECRET_KEY`): set during the maintainer proof deploy in [deploy-setup.md](./deploy-setup.md) (`wrangler login`, then `wrangler secret put` / `wrangler preview base-config secret put`).

## Verification

- Health: `https://we-met.link/` loads over HTTPS (placeholder landing page until cutover content ships).
- Pipeline: controlled form submit in preview after exchange API and consumer land ([test-leads.md](./test-leads.md)).

## Logs

- **App Worker:** Cloudflare dashboard → Workers & Pages → **we-met** → Logs (production) or select Preview `pr-<n>`.
- **Queues:** Workers & Pages → Queues → `we-met-followup-email` / `we-met-followup-email-nonprod`.
- **Consumers:** Workers **we-met-followup-email-consumer** / **we-met-followup-email-consumer-nonprod** ([DIDI-577](https://linear.app/didi-build/issue/DIDI-577)).
- **GitHub:** Actions runs for workflows **Preview** and **Deploy production**.
