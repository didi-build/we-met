# Deploy setup (one-time account and GitHub steps)

Complete these steps **before** relying on CI previews or production deploys. Hosting and preview behavior are documented in [deploy.md](./deploy.md), [0019](../decisions/0019-pr-preview-github-action.md), and [0020](../decisions/0020-d1-database-id-injection.md) (original rollout: [DIDI-572](https://linear.app/didi-build/issue/DIDI-572)). **Do not paste secrets or tokens into chat.**

## 1. Proof deploy (maintainer, `wrangler login`)

Run this **first** as the maintainer. Use **`npx wrangler login`** (OAuth) for all Cloudflare commands in this section — **no** `CLOUDFLARE_API_TOKEN` environment variables.

Use the same **generated config** as CI: `node scripts/prepare-wrangler-config.mjs` → gitignored **`wrangler.ci.jsonc`** at the repo root, with real D1 IDs from environment variables (not a hand-copied `wrangler.local.jsonc`).

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

npx wrangler preview base-config secret put WE_MET_TOKEN_SECRET
npx wrangler preview base-config secret put TURNSTILE_SECRET_KEY
```

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

| Token name (dashboard) | GitHub secret                     | Scopes (verified **2026-10-11** where noted)                                                                                                                                                                                                                               |
| ---------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `we-met-ci-nonprod`    | `CLOUDFLARE_API_TOKEN_NONPROD`    | **Workers Editor**, scoped to Worker **`we-met`** only. No zone policy (previews do not touch `we-met.link`). No R2 or Queues permissions initially.                                                                                                                       |
| `we-met-ci-production` | `CLOUDFLARE_API_TOKEN_PRODUCTION` | **Workers Editor** on **`we-met`**, plus account-level **D1 Edit** (dashboard **D1 Write**) for `wrangler d1 migrations apply`, plus a **third policy**: **Specified Domains** → `we-met.link` with **Workers Routes Write** and **Zone Read**. No R2 or Queues initially. |

Add further permissions **only** when a **403** names them (Cloudflare 403 responses link to the required permission). **Never use Admin as the fix.**

The **consumer Worker** ([DIDI-577](https://linear.app/didi-build/issue/DIDI-577)) is a separate script: the maintainer must create that Worker first (outside this runbook’s proof deploy). CI will need either a dedicated scoped token for that Worker or additional scopes on a token — decide when the consumer ships.

Details and caveats: [0017](../decisions/0017-cloudflare-api-credentials.md).

### First CI run results

After PR #3 merged (**2026-10-11**), the first GitHub Actions runs (Wrangler **4.149.0**) confirmed:

1. **Preview create:** `preview` workflow with **Workers Editor** on `we-met` created preview `pr-3`; its workers.dev URL served the placeholder page, the PR got the preview comment and “View deployment”, and the `preview` check passed in ~52s.
2. **Preview delete:** closing/merging the PR ran `cleanup`; log reported preview `pr-3` deleted successfully and the URL showed Cloudflare’s empty Workers page — **Editor** on `we-met` can create and delete previews (Wrangler’s open-beta warning on `preview delete` is harmless).
3. **Approval gate:** **Deploy production** stopped at “production waiting for review” with no steps until a maintainer approved.
4. **Production migrations + build:** with **D1 Write** on the production token, `wrangler d1 migrations apply` reported no migrations to apply; the Ubuntu build with the production Turnstile key passed in ~47s.
5. **Production deploy (first attempt failed):** `opennextjs-cloudflare deploy` failed on custom domains with `The zone "we-met.link" does not exist on your account [code: 10084]` — the token had no zone access; Wrangler re-sends the route each deploy. The live site kept the previous version.
6. **Production deploy (re-run succeeded):** after adding the zone policy (**Workers Routes Write** + **Zone Read** on `we-met.link` only), re-running the failed job completed; `https://we-met.link` returned HTTP **200**. Editing token policies did not require updating the GitHub secret.

## 3. GitHub secrets and variables

1. Create the **`preview`** environment (Settings → Environments → New environment): **no** required reviewers, **no** branch restriction (PR workflows run on `refs/pull/N/merge` and must not wait for approval). Security is equivalent to repository scope for these values; the environment exists for deployment history and symmetry with `production`. Add:
   - **Secret:** `CLOUDFLARE_API_TOKEN_NONPROD` (value from `we-met-ci-nonprod`)
   - **Variables:** `WE_MET_D1_DATABASE_ID_NONPROD`, `WE_MET_TURNSTILE_SITE_KEY_NONPROD` (widget **we-met nonprod**)
2. Create the **`production`** environment with yourself as a required reviewer. Under **Deployment branches**, choose **Selected branches** and allow **`main` only**.
3. **Repository secret:** `CLOUDFLARE_ACCOUNT_ID` only (used by both workflows).
4. **`production` environment secret:** `CLOUDFLARE_API_TOKEN_PRODUCTION` (value from `we-met-ci-production`).
5. **`production` environment variables:** `WE_MET_D1_DATABASE_ID_PRODUCTION`, `WE_MET_TURNSTILE_SITE_KEY_PRODUCTION` (widget **we-met production**).

Remove or rename any legacy unsuffixed `CLOUDFLARE_API_TOKEN` secrets. Do **not** duplicate `CLOUDFLARE_ACCOUNT_ID` on the `preview` or `production` environments unless you intentionally use a different account (the repo uses one repo-level `CLOUDFLARE_ACCOUNT_ID` for both workflows).

## 4. Guard failure demos (throwaway branch)

On a branch, temporarily break `wrangler.jsonc` (e.g. set preview queue to `we-met-followup-email`), run:

```bash
npm run deploy:guards
```

Confirm it fails; revert before merge.

## 5. After merge

Open a test PR and confirm **Preview** workflow comments a URL. Merge to `main` and confirm **Deploy production** waits for approval.
