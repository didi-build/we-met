# DIDI-572 — account-side steps (operator)

Repo-side workflows and guards land in [DIDI-572](https://linear.app/didi-build/issue/DIDI-572). Complete these **before** relying on CI previews/production. **Do not paste secrets or tokens into chat.**

## 1. GitHub secrets and variables

1. Create the **`production`** environment with yourself as a required reviewer.
2. **Repository secrets** (non-prod Cloudflare token): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
3. **`production` environment secrets:** production-scoped `CLOUDFLARE_API_TOKEN` (and `CLOUDFLARE_ACCOUNT_ID` if not reused from repo).
4. **Repository variables:** `WE_MET_D1_DATABASE_ID_NONPROD`, `WE_MET_TURNSTILE_SITE_KEY_NONPROD` (widget **we-met nonprod**).
5. **`production` environment variables:** `WE_MET_D1_DATABASE_ID_PRODUCTION`, `WE_MET_TURNSTILE_SITE_KEY_PRODUCTION` (widget **we-met production**).

Token scopes: narrow each token to Workers, D1, R2, Queues, and Zone DNS as needed; previews use the **same** Worker `we-met` as production ([0017](../decisions/0017-cloudflare-api-credentials.md)).

## 2. Worker secrets

Non-prod values (preview base):

```bash
npx wrangler preview base-config secret put WE_MET_TOKEN_SECRET
npx wrangler preview base-config secret put TURNSTILE_SECRET_KEY
```

Production Worker (production API token):

```bash
npx wrangler secret put WE_MET_TOKEN_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Use different values per environment.

## 3. Proof deploy (item 1) — local commands

Use a **gitignored** config with real D1 IDs (copy `wrangler.jsonc` → `wrangler.local.jsonc`, replace placeholder UUIDs from [DIDI-570](https://linear.app/didi-build/issue/DIDI-570)). Export production-scoped token only for the production deploy step; use non-prod token for preview.

```bash
npm ci
npm run build

# Production Worker placeholder (workers.dev + we-met.link route when domain attached)
npx wrangler deploy --config wrangler.local.jsonc

# Preview (Wrangler 4.135+)
npx wrangler preview --config wrangler.local.jsonc --name didi-572-proof --json
```

Paste command output (no secrets) back on **DIDI-572**.

### Effective preview bindings

After preview is live, confirm bindings (dashboard: Worker **we-met** → Previews → `didi-572-proof` → Bindings), or:

```bash
npx wrangler preview secret list --name didi-572-proof
```

Expect non-prod queue `we-met-followup-email-nonprod`, D1 `we-met-db-nonprod`, R2 `we-met-assets-nonprod`, rate limiter namespace **2001**, plus **ASSETS** (top-level assets upload), **IMAGES** (`previews.images`), and note **WORKER_SELF_REFERENCE** still targets production per Cloudflare limitation.

Delete proof preview:

```bash
npx wrangler preview delete --name didi-572-proof --skip-confirmation
```

## 4. Guard failure demos (throwaway branch)

On a branch, temporarily break `wrangler.jsonc` (e.g. set preview queue to `we-met-followup-email`), run:

```bash
npm run deploy:guards
```

Confirm it fails; revert before merge.

## 5. After merge

Open a test PR and confirm **Preview** workflow comments a URL. Merge to `main` and confirm **Deploy production** waits for approval.
