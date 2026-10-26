# Deploy setup (one-time account and GitHub steps)

Complete these steps **before** relying on CI previews or production deploys. Hosting and preview behavior are documented in [deploy.md](./deploy.md), [0019](../decisions/0019-pr-preview-github-action.md), and [0020](../decisions/0020-d1-database-id-injection.md) (original rollout: [DIDI-572](https://linear.app/didi-build/issue/DIDI-572)). **Do not paste secrets or tokens into chat.**

## 1. Proof deploy (maintainer, `wrangler login`)

Run this **first** as the maintainer. Use **`npx wrangler login`** (OAuth) for all Cloudflare commands in this section — **no** `CLOUDFLARE_API_TOKEN` environment variables.

Use the same **generated config** as CI: `node scripts/prepare-wrangler-config.mjs` → gitignored **`wrangler.ci.jsonc`** at the repo root, with real D1 IDs from your shell `export` (same env var names as CI secrets; not a hand-copied `wrangler.local.jsonc`).

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is inlined at **build time**, so **production and preview each need their own `npm run build`** with the matching widget site key before deploy or preview.

### a. Login and D1 IDs

```bash
npx wrangler login
npx wrangler whoami
npx wrangler d1 list
```

Export both database UUIDs (for example `WE_MET_D1_DATABASE_ID_PRODUCTION` and `WE_MET_D1_DATABASE_ID_NONPROD`) from the `d1 list` output.

```bash
npm ci
```

### b. Production deploy

```bash
export WE_MET_D1_DATABASE_ID_PRODUCTION='<production-db-uuid>'
export NEXT_PUBLIC_TURNSTILE_SITE_KEY='<production-widget-site-key>'

npm run build
node scripts/prepare-wrangler-config.mjs --target production --output wrangler.ci.jsonc
node scripts/check-deploy-guards.mjs --target production --config wrangler.ci.jsonc
npx opennextjs-cloudflare deploy --config wrangler.ci.jsonc
curl -sI https://we-met.link
```

### c. Preview deploy

```bash
export WE_MET_D1_DATABASE_ID_NONPROD='<nonprod-db-uuid>'
export NEXT_PUBLIC_TURNSTILE_SITE_KEY='<nonprod-widget-site-key>'

npm run build
node scripts/prepare-wrangler-config.mjs --target preview --output wrangler.ci.jsonc
node scripts/check-deploy-guards.mjs --target preview --config wrangler.ci.jsonc
npx wrangler preview --config wrangler.ci.jsonc --name deploy-proof --json
```

From the JSON, read `.preview.urls[0]`, then `curl -sI` that URL. When finished:

```bash
npx wrangler preview delete --name deploy-proof --skip-confirmation
```

(Verified **2026-10-11:** delete is safe to run twice; the second run on a missing preview is fine.)

### d. Do not mix production and preview builds

**Never** run production deploy (`opennextjs-cloudflare deploy`) from a shell that still has the **non-prod** Turnstile site key exported, or a `wrangler.ci.jsonc` generated with `--target preview`. Re-run **`npm run build`** with the production site key and **`prepare-wrangler-config.mjs --target production`** before any production deploy.

### Worker secrets

After the production Worker exists, set secrets while still on `wrangler login` (use different values per environment):

```bash
npx wrangler secret put WE_MET_TOKEN_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

npx wrangler preview base-config secret put WE_MET_TOKEN_SECRET
npx wrangler preview base-config secret put TURNSTILE_SECRET_KEY
```

**Local development:** copy `WE_MET_APP_ORIGIN` from `.env.example` into `.env.local` (typically `http://localhost:3000`). Google OAuth uses a separate dev client with redirect URI on that origin.

### Staging (`we-met-staging`) first deploy

Attach custom domain **`we-met.didi.build`** only after Diadem approves that DNS change ([DIDI-874](https://linear.app/didi-build/issue/DIDI-874)) and the maintainer creates Worker **`we-met-staging`** once ([DIDI-875](https://linear.app/didi-build/issue/DIDI-875)). Staging shares **no** production secrets, OAuth client, or D1/R2 data with production ([0028](../decisions/0028-staging-we-met-didi-build.md)).

**Build:** export **`WE_MET_ENV=staging`** and **`NEXT_PUBLIC_TURNSTILE_SITE_KEY`** from **`WE_MET_TURNSTILE_SITE_KEY_NONPROD`** before `npm run build` (see `next.config.ts`). Staging CI uses the same variable name on the GitHub **`staging`** environment.

**Manual bootstrap (before `deploy-staging.yml` exists):** from `main`, with `npx wrangler login`, prepare the staging Wrangler config per [DIDI-879](https://linear.app/didi-build/issue/DIDI-879) (`wrangler.staging.jsonc`), run deploy-time guards for the staging target, then deploy Worker **`we-met-staging`** and attach the custom domain. Do **not** use production `opennextjs-cloudflare deploy` against **`we-met`**.

**Secrets on `we-met-staging` ([DIDI-876](https://linear.app/didi-build/issue/DIDI-876)):** use a **separate** Google OAuth client (non-prod) with the redirect URIs below. **Never** copy production `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `WE_MET_TOKEN_SECRET`, or `TURNSTILE_SECRET_KEY` onto staging.

**Warning:** every staging secret command must include **`--name we-met-staging`** or **`--config <staging-wrangler-file>`**. A bare `npx wrangler secret put <NAME>` without `--name` targets production Worker **`we-met`**.

```bash
npx wrangler secret put WE_MET_TOKEN_SECRET --name we-met-staging
npx wrangler secret put TURNSTILE_SECRET_KEY --name we-met-staging
npx wrangler secret put BOOKING_URL --name we-met-staging
npx wrangler secret put GOOGLE_CLIENT_ID --name we-met-staging
npx wrangler secret put GOOGLE_CLIENT_SECRET --name we-met-staging
# optional:
npx wrangler secret put CONTACTS_SETUP_ALLOWLIST --name we-met-staging
```

Do **not** set **`WE_MET_PREVIEW_LOGIN_SECRET`** on staging (preview-only; [0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)).

Register these **authorized redirect URIs** on the **staging** Google OAuth client (exact match; no wildcards):

- `https://we-met.didi.build/api/auth/google/callback`
- `https://we-met.didi.build/api/auth/google/contacts/callback`

Confirm with `npx wrangler secret list --name we-met-staging` (names only).

### App host (`app.we-met.link`)

Production `wrangler.jsonc` attaches **two** custom domains to Worker **`we-met`**: `we-met.link` (public cards) and **`app.we-met.link`** (editor SPA and `/api/app/*` + `/api/auth/*`). That route has been on the production Worker since commit **4bab8b5** (last production deploy before MVP backend work); **`app.we-met.link` already resolves to the same Worker** and today serves the **placeholder** shipped in that deploy. PR previews use **workers.dev** only; they never receive the `app.we-met.link` route (`check-deploy-guards.mjs` enforces this).

**At MVP cutover ([DIDI-618](https://linear.app/didi-build/issue/DIDI-618)):**

1. Ensure production Worker secrets include `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (names only above).
2. Merge the MVP backend branches and obtain the usual **production** environment approval.
3. On the **approved production deploy**, Cloudflare updates the **already-bound** `app.we-met.link` route to run the new Worker version (real editor + auth API). The cutover deploy does **not** attach the hostname for the first time; it changes what that hostname serves.
4. Sign in on `app.we-met.link`, publish cards, and verify exchange still works on `we-met.link`.

**UNVERIFIED:** Whether preview base-config secrets (`WE_MET_TOKEN_SECRET`, `TURNSTILE_SECRET_KEY`, set with `wrangler preview base-config secret put`) are inherited and readable by a preview. The placeholder app does not read them. The first real test is the exchange API smoke test after [DIDI-575](https://linear.app/didi-build/issue/DIDI-575/exchange-api-exchange-and-details-endpoints-turnstile-rate-limit-lead) and [DIDI-577](https://linear.app/didi-build/issue/DIDI-577/email-consumer-own-queue-consumer-gmail-sender-behind-an-interface) ship.

Confirm names only (values are never printed):

```bash
npx wrangler secret list --name we-met
```

Paste command output (no secrets) on the Linear hosting ticket when asked.

### Effective preview bindings

Bindings appear in the **`wrangler preview --json`** output under **`deployment.env`** (verified **2026-10-11**), and in the dashboard (Worker **we-met** → Previews → `deploy-proof` → Bindings). **UNVERIFIED:** `npx wrangler preview secret list --name <preview>` was not exercised in the proof deploy.

Expect non-prod queue `we-met-followup-email-nonprod`, D1 `we-met-db-nonprod`, R2 `we-met-assets-nonprod`, rate limiter namespace **2001**, plus **ASSETS** and **IMAGES** (`previews.images`). Preview deployments do **not** get **`WORKER_SELF_REFERENCE`** (production does).

### Redeploy check

After changing **`preview_urls`** or **`workers_dev`** in `wrangler.jsonc`, redeploy and confirm in the dashboard (Worker **we-met** → **Domains**): **Preview URLs** on, production **workers.dev** off. Verified **2026-10-11:** redeploy with `preview_urls: true` and `workers_dev: false` turned the Preview toggle **on** after it had been switched off manually; production workers.dev stayed off. Production Worker **secrets survive** a redeploy.

Deploy logs may label a queue binding **“(inherited)”** on redeploy; that is cosmetic. Confirm the real binding with:

```bash
npx wrangler versions view <version-id> --name we-met
```

(use the Current Version ID printed at the end of the production deploy output).

### Questions the proof deploy must answer

- [x] Does the live preview URL serve the OpenNext app (not just a static stub)? **Answer (2026-10-11):** Yes — HTTP **200** on `/` with the OpenNext-built placeholder page.
- [x] How does `WORKER_SELF_REFERENCE` behave on a preview? **Answer:** Preview deployments do **not** include a `WORKER_SELF_REFERENCE` binding; production does. The placeholder app served `/` without it; impact on the real card flow is **unknown until the card ships** ([0019](../decisions/0019-pr-preview-github-action.md#proof-deploy-findings)).
- [x] Does `opennextjs-cloudflare deploy --config wrangler.ci.jsonc` use the generated config end to end? **Answer:** Yes — deploy succeeds; incremental/tag cache steps report no population needed for this config.

If the account’s **workers.dev** subdomain is ever renamed, update the **we-met nonprod** Turnstile widget hostname, set `previews.vars.WE_MET_PREVIEW_HOST_SUFFIX` in `wrangler.jsonc` to match (`-<worker-name>.<subdomain>.workers.dev`), and re-check **Preview URLs** (`preview_urls: true`).

## 2. Cloudflare API tokens for CI

Create these **after** the proof deploy (the `we-met` Worker and `we-met.link` route already exist). Store values in GitHub as [documented below](#3-github-secrets-and-variables) and in [deploy.md](./deploy.md).

Cloudflare supports **resource-scoped Workers roles** ([Workers granular authorization](https://blog.cloudflare.com/workers-granular-authorization), September 2026): **Editor** on a single Worker can deploy without creating or deleting resources. Because `wrangler.jsonc` attaches **`we-met.link` as a custom domain**, every production CI deploy re-sends that route — the production token needs a **zone** policy on `we-met.link` (see table and [0017](../decisions/0017-cloudflare-api-credentials.md)). Legacy **Workers Scripts Edit** maps to **Editor** in Cloudflare’s migration table (no published deprecation date). **D1 / R2 / KV resource-level token scoping is not available yet** — those permissions remain account-level.

| Token name (dashboard)          | GitHub secret                              | Scopes (verified **2026-10-11** where noted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `we-met-ci-nonprod`             | `CLOUDFLARE_API_TOKEN_NONPROD`             | **Workers Editor**, scoped to Worker **`we-met`** only. No zone policy (previews do not touch `we-met.link`). No R2 or Queues permissions initially.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `we-met-ci-production`          | `CLOUDFLARE_API_TOKEN_PRODUCTION`          | **Workers Editor** on **`we-met`**, plus account-level **D1 Edit** (dashboard **D1 Write**) for `wrangler d1 migrations apply`, plus a **third policy**: **Specified zone** → `we-met.link` with **Workers Routes Write** and **Zone Read**. No R2 or Queues initially.                                                                                                                                                                                                                                                                                                                                                                                             |
| `we-met-ci-consumer-production` | `CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION` | **Workers Editor** on **`we-met-followup-email-consumer`** only, plus account-level **Queues Edit** (dashboard **Queues** → **Edit**). Wrangler lists queues during deploy (verified **2026-10-14**: first CI consumer deploy failed with `Authentication error [code: 10000]` on queue list until **Queues Edit** was added; D1 was not required despite a D1 binding). Stored only on the GitHub **`production`** environment. Do not widen `we-met-ci-production`. **Not tested:** minimal queue permission vs **Queues Edit**.                                                                                                                                  |
| `we-met-ci-consumer-nonprod`    | `CLOUDFLARE_API_TOKEN_CONSUMER_NONPROD`    | **Workers Editor** on **`we-met-followup-email-consumer-nonprod`** only, plus account-level **Queues Edit** (same pattern as the production consumer token). Stored only on the GitHub **`consumer-nonprod`** environment. **Workers Editor** plus **Queues Edit** is sufficient for `wrangler secret list` (names only) before deploy (verified **2026-10-17** on [Deploy consumer non-prod run 39083067044](https://github.com/didi-build/we-met/actions/runs/39083067044)).                                                                                                                                                                                      |
| `we-met-ci-migrate-nonprod`     | `CLOUDFLARE_API_TOKEN_MIGRATE_NONPROD`     | **D1 Edit** only (account-level). Verified **2026-10-13:** the Cloudflare token builder only offered account-level D1 (**Entire account**, **D1 Write** and **D1 Read**); no per-database scope was available. One-year expiry; calendar reminder.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `we-met-ci-staging`             | `CLOUDFLARE_API_TOKEN_STAGING`             | **Workers Editor** on Worker **`we-met-staging`** only; account-level **D1 Edit** for `wrangler d1 migrations apply` on **`we-met-db-nonprod`** (accepted: D1 cannot be scoped to one database; workflow must never target **`we-met-db`**); **Specified zone** **`didi.build`** with **Workers Routes Write** and **Zone Read** only ([0017](../decisions/0017-cloudflare-api-credentials.md)). Stored only on GitHub **`staging`** (`main` only). Wrangler re-sends the custom domain each deploy. **Risk:** Routes Write on the whole `didi.build` zone. No R2 or Queues unless CI returns a named 403 ([0028](../decisions/0028-staging-we-met-didi-build.md)). |

### GitHub Actions policy (pull_request_target)

**Why:** GitHub blocks `pull_request_target` by default on public repositories from **2026-11-02** for repositories without an applicable event policy.

**Current configuration (verified by the maintainer on 2026-10-13 from the repository Settings page):**

- **Location:** repository **Settings → Actions → Policies** (an **Actions policy**, separate from General). It is an **event policy** under **Workflow execution protections**.
- **Policy name:** `Allow pull_request_target for trusted workflows`
- **Enforcement status:** Active
- **Target workflows (path criteria):**
  - `.github/workflows/privileged-change.yml`
  - `.github/workflows/migrate-nonprod.yml`
  - `.github/workflows/dependabot-automerge.yml`
- **Restrict events:** ON. **Allowed events:** `pull_request_target`, `workflow_dispatch`, `workflow_run`
- **Restrict actors:** OFF
- **Require lockfile** (preview feature): OFF

**Why each workflow is targeted:**

| Workflow                   | Triggers covered by the policy                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `privileged-change.yml`    | `pull_request_target` ([DIDI-593](https://linear.app/didi-build/issue/DIDI-593))                                         |
| `migrate-nonprod.yml`      | `pull_request_target` and `workflow_dispatch` (manual retries; [DIDI-592](https://linear.app/didi-build/issue/DIDI-592)) |
| `dependabot-automerge.yml` | `pull_request_target` and `workflow_run` (the `workflow_run` trigger performs the actual auto-merge after CI finishes)   |

**Restrict events is an allowlist for the targeted workflows only.** Never target **All workflows** with a restricted event list: CI, Preview, and other workflows use `pull_request` and `push` and would stop running.

**Setup rule:** Any new workflow that uses `pull_request_target` must be added to this policy’s targets (and its events to the allowed list), or it is blocked once the default applies. `npm run check` enforces this allowlist in git (see **Repo guard** below). The repo file `.github/actions-policy-workflows.json` mirrors the GitHub setting; **update both together** when the policy changes.

**UNVERIFIED (policy page copy):** The policy UI says GitHub features such as Dependabot are exempt. Our reading is that this refers to GitHub’s own Dependabot runs (**Dependabot Updates**), not our `dependabot-automerge.yml` workflow, which is why that workflow is targeted explicitly. It is unknown how the default rule treats workflows the policy does not target.

**Verification steps:**

| Step                                                                                                     | Status                                              |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `privileged-change` run after the policy is active shows no policy warning annotation and posts normally | To be checked, dated, by the maintainer             |
| First real `migrate-nonprod` run shows no policy warning and the plan job starts                         | UNVERIFIED until the first PR that adds a migration |
| A **Dependabot auto-merge** `workflow_run` appears after CI finishes on a PR                             | UNVERIFIED until checked                            |
| CI and Preview still start on pushes                                                                     | To be checked, dated                                |

**Repo guard (cannot read GitHub):** `scripts/check-actions-policy-workflows.mjs` (part of `npm run check`) compares every file under `.github/workflows/` to `.github/actions-policy-workflows.json`. It cannot see the live policy in **Settings → Actions → Policies**. When the check fails, update **both** the GitHub policy and the JSON file. The check uses block-style `on:` parsing via `extractWorkflowMetadata` (no extra YAML dependency); inline `on:` forms fail closed.

Add further Cloudflare token permissions **only** when a **403** names them (Cloudflare 403 responses link to the required permission). **Never use Admin as the fix.**

The **non-prod follow-up email consumer** ([DIDI-577](https://linear.app/didi-build/issue/DIDI-577)) deploys from **`main`** via [**Deploy consumer non-prod**](../../.github/workflows/deploy-consumer-nonprod.yml) ([DIDI-652](https://linear.app/didi-build/issue/DIDI-652)); manual steps below are the **fallback** (for example deploying a PR branch’s consumer to non-prod). The **production** consumer is **hand-deployed once** on `main`, then ongoing deploys run from **Deploy production** ([DIDI-599](https://linear.app/didi-build/issue/DIDI-599)) — see [first-deploy checklist](#production-follow-up-email-consumer-first-deploy-didi-599).

Details and caveats: [0017](../decisions/0017-cloudflare-api-credentials.md).

### Non-prod follow-up email consumer (CI default; manual fallback)

**Default:** every push to **`main`** runs **Deploy consumer non-prod** (no path filter; the consumer bundles shared email code). The job uses GitHub environment **`consumer-nonprod`**, checks required Worker **secret names** (never values), then `wrangler deploy` with commit SHA in **`--message`** and **`--tag`**. It does **not** run `wrangler secret put`.

**Manual fallback** (PR branch or when CI is unavailable): use **`npx wrangler login`** (OAuth). From the repo root. **Never** export `WE_MET_D1_DATABASE_ID_PRODUCTION` in this shell.

```bash
export WE_MET_D1_DATABASE_ID_NONPROD='<nonprod-db-uuid>'
node scripts/prepare-wrangler-config.mjs \
  --target consumer-nonprod \
  --output workers/we-met-followup-email-consumer/wrangler.nonprod.ci.jsonc
npm run deploy:guards   # includes consumer-nonprod guards on committed configs
node scripts/check-deploy-guards.mjs \
  --target consumer-nonprod \
  --config workers/we-met-followup-email-consumer/wrangler.nonprod.ci.jsonc
npm run worker:consumer-dry-run:nonprod
npx wrangler deploy --config workers/we-met-followup-email-consumer/wrangler.nonprod.ci.jsonc
```

**Order matters:** deploy the consumer **first** so the Worker exists, then set secrets **immediately** afterward. The first deploy attaches the consumer to `we-met-followup-email-nonprod`, which **starts draining the queue immediately**; queued messages retry, but do not leave the Worker without secrets for long.

**UNVERIFIED:** whether `wrangler secret put` against a Worker name that has never been deployed creates the Worker or fails until the first deploy.

```bash
npx wrangler secret put WE_MET_EMAIL_FROM_CLOUDFLARE --name we-met-followup-email-consumer-nonprod
npx wrangler secret put WE_MET_FROM_DISPLAY_NAME --name we-met-followup-email-consumer-nonprod
npx wrangler secret put WE_MET_TEST_MAIL_TO --name we-met-followup-email-consumer-nonprod
```

**Deploy order (`WE_MET_FROM_DISPLAY_NAME`):** set `WE_MET_FROM_DISPLAY_NAME` on **both** consumers (`we-met-followup-email-consumer-nonprod` and `we-met-followup-email-consumer`) **before** deploying consumer code that requires it. A missing or invalid value fails closed; visitor follow-ups and owner sink mail retry until the secret is set or attempts are exhausted.

`WE_MET_TEST_MAIL_TO` is **non-prod only** (never on the production consumer). Confirm binding names with `npx wrangler versions view <version-id> --name we-met-followup-email-consumer-nonprod`.

After setup, `npx wrangler secret list --name we-met-followup-email-consumer-nonprod` must include `WE_MET_EMAIL_FROM_CLOUDFLARE`, `WE_MET_FROM_DISPLAY_NAME`, and `WE_MET_TEST_MAIL_TO` (matches [Deploy consumer non-prod](../../.github/workflows/deploy-consumer-nonprod.yml)). The three legacy Gmail-era names (`GMAIL_SERVICE_ACCOUNT_JSON`, `GMAIL_SENDER`, `WE_MET_OWNER_FROM_EMAIL`) may also appear until [DIDI-799](https://linear.app/didi-build/issue/DIDI-799) deletes them.

**Retries:** visitor follow-up uses `max_retries: 30` with exponential backoff capped at 30 minutes (~**12 hours** worst-case delay before permanent failure; see [environments.md](../architecture/environments.md)). Unsupported queue types retry on the same schedule until Cloudflare deletes them at the limit. A missing mail secret or provider outage drops the visitor email with only log lines (`visitor_followup_attempt_failure` / `visitor_followup_permanent_failure`).

### Production follow-up email consumer (first deploy, DIDI-599)

A Worker-scoped **`we-met-ci-consumer-production`** token cannot be created until Worker **`we-met-followup-email-consumer`** exists. **Hand-deploy the production consumer once** on `main` before creating that token or approving the first post-merge **Deploy production** run that includes the consumer CI step.

The first deploy **attaches the consumer to the production queue** and **starts draining** it (messages from the last **24 hours** may be processed). Set consumer mail secrets **immediately** after that deploy; without them, sends fail and retry for about **12 hours**.

**Maintainer checklist (names only, in order):**

1. Merge PR #18; **Deploy production** on `main` starts and waits at approval — **do not approve yet**.
2. On `main`, export **`WE_MET_D1_DATABASE_ID_PRODUCTION`** (never **`WE_MET_D1_DATABASE_ID_NONPROD`** in this shell). Run `node scripts/prepare-wrangler-config.mjs --target consumer-production --output workers/we-met-followup-email-consumer/wrangler.production.ci.jsonc`, then `node scripts/check-deploy-guards.mjs --target consumer-production --config workers/we-met-followup-email-consumer/wrangler.production.ci.jsonc`, then `npx wrangler login`, then `npx wrangler deploy --config workers/we-met-followup-email-consumer/wrangler.production.ci.jsonc`.
3. Immediately `npx wrangler secret put WE_MET_EMAIL_FROM_CLOUDFLARE` and `npx wrangler secret put WE_MET_FROM_DISPLAY_NAME` with `--name we-met-followup-email-consumer`; then `npx wrangler secret list --name we-met-followup-email-consumer` must show **exactly** those two names and **never** `WE_MET_TEST_MAIL_TO`.
4. Create dashboard token **`we-met-ci-consumer-production`** with **Workers Editor** on Worker **`we-met-followup-email-consumer`** only and account-level **Queues Edit**; add GitHub secret **`CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION`** on the **`production`** environment.
5. Approve the waiting **Deploy production** run.
6. One dated test submission to the maintainer's own address ([test-leads.md](./test-leads.md)).

**Recovery:** if the consumer deploy step fails after the app deploy succeeded, re-run the **full** Deploy production job after fixing the error ([deploy.md](./deploy.md)).

**Verified (2026-10-14):** production consumer Worker secrets **survive** a CI redeploy (secret names still present after a successful consumer deploy step). Code no longer reads Gmail-era secret names ([DIDI-795](https://linear.app/didi-build/issue/DIDI-795)); Wrangler deletion is [DIDI-799](https://linear.app/didi-build/issue/DIDI-799). The [first-deploy checklist](#production-follow-up-email-consumer-first-deploy-didi-599) step 3 above reflects the two required production names.

Production consumer secrets (same two names as step 3):

```bash
npx wrangler secret put WE_MET_EMAIL_FROM_CLOUDFLARE --name we-met-followup-email-consumer
npx wrangler secret put WE_MET_FROM_DISPLAY_NAME --name we-met-followup-email-consumer
```

Smoke test: [test-leads.md](./test-leads.md) (exchange on a PR preview → mail at `WE_MET_TEST_MAIL_TO`).

### First CI run results

After PR #3 merged (**2026-10-11**), the first GitHub Actions runs (Wrangler **4.149.0**) confirmed:

1. **Preview create:** `preview` workflow with **Workers Editor** on `we-met` created preview `pr-3`; its workers.dev URL served the placeholder page, the PR got the preview comment and “View deployment”, and the `preview` check passed in ~52s.
2. **Preview delete:** closing/merging the PR ran `cleanup`; log reported preview `pr-3` deleted successfully and the URL showed Cloudflare’s empty Workers page — **Editor** on `we-met` can create and delete previews (Wrangler’s open-beta warning on `preview delete` is harmless).
3. **Approval gate:** **Deploy production** stopped at “production waiting for review” with no steps until a maintainer approved.
4. **Production migrations + build:** with **D1 Write** on the production token, `wrangler d1 migrations apply` reported no migrations to apply; the Ubuntu build with the production Turnstile key passed in ~47s.
5. **Production deploy (first attempt failed):** `opennextjs-cloudflare deploy` failed on custom domains with `The zone "we-met.link" does not exist on your account [code: 10084]` — the token had no zone access; Wrangler re-sends the route each deploy. The live site kept the previous version.
6. **Production deploy (re-run succeeded):** after adding the zone policy (**Workers Routes Write** + **Zone Read** on `we-met.link` only), re-running the failed job completed; `https://we-met.link` returned HTTP **200**. Editing token policies did not require updating the GitHub secret.

After the production follow-up email consumer shipped (**2026-10-14**), the first **Deploy production** run that included the consumer CI step showed:

7. **Production consumer deploy (first attempt failed):** `wrangler deploy` for **`we-met-followup-email-consumer`** failed listing queues with `Authentication error [code: 10000]` — token **`we-met-ci-consumer-production`** had **Workers Editor** on the consumer only, no queue permission.
8. **Production consumer deploy (after token fix):** adding account-level **Queues Edit** to the same dashboard token and re-running the job succeeded. **D1 Edit** was not required for this deploy despite a D1 binding on the consumer config. Consumer secrets set right after the hand deploy were still present after the CI redeploy.

## 3. GitHub secrets and variables

1. Create the **`preview`** environment (Settings → Environments → New environment): **no** required reviewers, **no** branch restriction (PR workflows run on `refs/pull/N/merge` and must not wait for approval). Security is equivalent to repository scope for these values; the environment exists for deployment history and symmetry with `production`. Add:
   - **Secret:** `CLOUDFLARE_API_TOKEN_NONPROD` (value from `we-met-ci-nonprod`; also used by **Gallery preview** for `gallery-pr-<n>` on Worker `we-met` via `wrangler.gallery.jsonc`, not a separate Worker token)
   - **Secrets:** `WE_MET_D1_DATABASE_ID_NONPROD` (same UUID as non-prod D1; masked in Actions logs)
   - **Variables:** `WE_MET_TURNSTILE_SITE_KEY_NONPROD` (widget **we-met nonprod**)
2. Create the **`production`** environment with yourself as a required reviewer. Under **Deployment branches**, choose **Selected branches** and allow **`main` only**.
3. **Repository secret:** `CLOUDFLARE_ACCOUNT_ID` only (used by preview, staging, consumer non-prod, and production workflows).
4. **`production` environment secrets:** `CLOUDFLARE_API_TOKEN_PRODUCTION` (value from `we-met-ci-production`); `CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION` (value from `we-met-ci-consumer-production`).
5. **`production` environment secrets:** `WE_MET_D1_DATABASE_ID_PRODUCTION` (masked in Actions logs). **Variables:** `WE_MET_TURNSTILE_SITE_KEY_PRODUCTION` (widget **we-met production**).
6. Create the **`migrate-nonprod`** environment with yourself as required reviewer. **Deployment branches:** **`main` only**. Turn **Prevent self-review** **off** (you are the only reviewer; runs you push must still be approvable). Add:
   - **Secret:** `CLOUDFLARE_API_TOKEN_MIGRATE_NONPROD` (from `we-met-ci-migrate-nonprod`; **never** as a repository or organization secret)
   - **Secret:** `WE_MET_D1_DATABASE_ID_NONPROD` (same value as `preview`)
7. Create the **`consumer-nonprod`** environment: **no** required reviewers (non-prod, like `preview`). **Deployment branches:** **`main` only**. Add:
   - **Secret:** `CLOUDFLARE_API_TOKEN_CONSUMER_NONPROD` (from `we-met-ci-consumer-nonprod`)
   - **Secret:** `WE_MET_D1_DATABASE_ID_NONPROD` (same value as `preview`)
8. Create the **`staging`** environment ([0028](../decisions/0028-staging-we-met-didi-build.md)): **no** required reviewers. **Deployment branches:** **`main` only**. Add:
   - **Secret:** `CLOUDFLARE_API_TOKEN_STAGING` (from `we-met-ci-staging`)
   - **Secret:** `WE_MET_D1_DATABASE_ID_NONPROD` (same value as `preview`)
   - **Variable:** `WE_MET_TURNSTILE_SITE_KEY_NONPROD` (same non-prod widget site key as `preview`; hostnames must include **`we-met.didi.build`**)

Remove or rename any legacy unsuffixed `CLOUDFLARE_API_TOKEN` secrets. Do **not** duplicate `CLOUDFLARE_ACCOUNT_ID` on the `preview` or `production` environments unless you intentionally use a different account (the repo uses one repo-level `CLOUDFLARE_ACCOUNT_ID` for all workflows, including **`staging`** and **`consumer-nonprod`**).

**Known gap:** closing a PR without merging leaves its expand-only migration applied in shared non-prod D1; add a new migration to revert if needed.

## 4. Guard failure demos (throwaway branch)

On a branch, temporarily break `wrangler.jsonc` (e.g. set preview queue to `we-met-followup-email`), run:

```bash
npm run deploy:guards
```

Confirm it fails; revert before merge.

## 5. After merge

Open a test PR and confirm **Preview** workflow comments a URL. Merge to `main` and confirm **Deploy production** waits for approval.
