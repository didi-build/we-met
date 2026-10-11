# Deploy setup (one-time account and GitHub steps)

Complete these steps **before** relying on CI previews or production deploys. Hosting and preview behavior are documented in [deploy.md](./deploy.md), [0019](../decisions/0019-pr-preview-github-action.md), and [0020](../decisions/0020-d1-database-id-injection.md) (original rollout: [DIDI-572](https://linear.app/didi-build/issue/DIDI-572)). **Do not paste secrets or tokens into chat.**

## 1. Proof deploy (maintainer, `wrangler login`)

Run this **first** as the maintainer. Use **`wrangler login`** (OAuth) for all Cloudflare commands in this section — **no** `CLOUDFLARE_API_TOKEN` environment variables.

Use a **gitignored** config with real D1 IDs (copy `wrangler.jsonc` → `wrangler.local.jsonc`, replace placeholder UUIDs from [DIDI-570](https://linear.app/didi-build/issue/DIDI-570)).

```bash
wrangler login
npm ci
npm run build

# Creates the we-met Worker and attaches the we-met.link custom domain from wrangler.local.jsonc
npx wrangler deploy --config wrangler.local.jsonc

# Preview (Wrangler 4.135+)
npx wrangler preview --config wrangler.local.jsonc --name deploy-proof --json
```

Set **Worker secrets** while still authenticated via `wrangler login` (use different values per environment):

```bash
# Non-prod (preview base)
npx wrangler preview base-config secret put WE_MET_TOKEN_SECRET
npx wrangler preview base-config secret put TURNSTILE_SECRET_KEY

# Production Worker
npx wrangler secret put WE_MET_TOKEN_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Paste command output (no secrets) on the Linear hosting ticket when asked.

### Effective preview bindings

After preview is live, confirm bindings (dashboard: Worker **we-met** → Previews → `deploy-proof` → Bindings), or:

```bash
npx wrangler preview secret list --name deploy-proof
```

Expect non-prod queue `we-met-followup-email-nonprod`, D1 `we-met-db-nonprod`, R2 `we-met-assets-nonprod`, rate limiter namespace **2001**, plus **ASSETS** (top-level assets upload), **IMAGES** (`previews.images`), and note **WORKER_SELF_REFERENCE** still targets production per Cloudflare limitation.

Delete proof preview:

```bash
npx wrangler preview delete --name deploy-proof --skip-confirmation
```

### Questions the proof deploy must answer

- [ ] Does the live preview URL serve the OpenNext app (not just a static stub)? **How to check:** open the preview URL, load `/`, and confirm it renders the Next.js app and the Worker logs show requests.
- [ ] How does `WORKER_SELF_REFERENCE` behave on a preview? Cloudflare says service bindings from a Preview call the bound Worker’s production deployment. **How to check:** after the preview is live, confirm whether the app starts and serves `/` without needing the self-reference binding, or fails when it is used. Record the outcome in [0019](../decisions/0019-pr-preview-github-action.md#proof-deploy-findings).
- [ ] Does `opennextjs-cloudflare deploy --config wrangler.ci.jsonc` use the generated config end to end? **How to check:** read the first production deploy log for the Worker name, bindings, and any cache-population step.

## 2. Cloudflare API tokens for CI

Create these **after** the proof deploy (the `we-met` Worker and `we-met.link` route already exist). Store values in GitHub as [documented below](#3-github-secrets-and-variables) and in [deploy.md](./deploy.md).

Cloudflare supports **resource-scoped Workers roles** ([Workers granular authorization](https://blog.cloudflare.com/workers-granular-authorization), September 2026): **Editor** on a single Worker can deploy without creating or deleting resources. Changing routes or custom domains needs Editor on the Worker plus zone **Workers Routes**; once a route exists, deploys that do not change it need no zone access. Legacy **Workers Scripts Edit** maps to **Editor** in Cloudflare’s migration table (no published deprecation date). **D1 / R2 / KV resource-level token scoping is not available yet** — those permissions remain account-level.

| Token name (dashboard) | GitHub secret                     | Scopes (initial)                                                                                                                                        |
| ---------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `we-met-ci-nonprod`    | `CLOUDFLARE_API_TOKEN_NONPROD`    | **Workers Editor**, scoped to Worker **`we-met`** only. No zone permissions (route already attached). No R2 or Queues permissions initially.            |
| `we-met-ci-production` | `CLOUDFLARE_API_TOKEN_PRODUCTION` | **Workers Editor** on **`we-met`**, plus **D1 Edit** (for `wrangler d1 migrations apply` in the production workflow). No zone, R2, or Queues initially. |

Add further permissions **only** when a **403** names them (Cloudflare 403 responses link to the required permission). **Never use Admin as the fix.**

The **consumer Worker** ([DIDI-577](https://linear.app/didi-build/issue/DIDI-577)) is a separate script: the maintainer must create that Worker first (outside this runbook’s proof deploy). CI will need either a dedicated scoped token for that Worker or additional scopes on a token — decide when the consumer ships.

Details and caveats: [0017](../decisions/0017-cloudflare-api-credentials.md).

## 3. GitHub secrets and variables

1. Create the **`production`** environment with yourself as a required reviewer. Under **Deployment branches**, choose **Selected branches** and allow **`main` only**.
2. **Repository secrets:** `CLOUDFLARE_API_TOKEN_NONPROD` (value from `we-met-ci-nonprod`), `CLOUDFLARE_ACCOUNT_ID`.
3. **`production` environment secret:** `CLOUDFLARE_API_TOKEN_PRODUCTION` (value from `we-met-ci-production`).
4. **Repository variables:** `WE_MET_D1_DATABASE_ID_NONPROD`, `WE_MET_TURNSTILE_SITE_KEY_NONPROD` (widget **we-met nonprod**).
5. **`production` environment variables:** `WE_MET_D1_DATABASE_ID_PRODUCTION`, `WE_MET_TURNSTILE_SITE_KEY_PRODUCTION` (widget **we-met production**).

Remove or rename any legacy unsuffixed `CLOUDFLARE_API_TOKEN` secrets. Do **not** duplicate `CLOUDFLARE_ACCOUNT_ID` on the production environment unless you intentionally use a different account (the repo uses one repo-level `CLOUDFLARE_ACCOUNT_ID` for both workflows).

## 4. Guard failure demos (throwaway branch)

On a branch, temporarily break `wrangler.jsonc` (e.g. set preview queue to `we-met-followup-email`), run:

```bash
npm run deploy:guards
```

Confirm it fails; revert before merge.

## 5. After merge

Open a test PR and confirm **Preview** workflow comments a URL. Merge to `main` and confirm **Deploy production** waits for approval.
