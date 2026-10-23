# 0020. Inject D1 database IDs at deploy time from GitHub variables

- **Status:** accepted
- **Date:** 2026-10-11

## Context

`wrangler.jsonc` is committed with placeholder `database_id` values so real Cloudflare D1 UUIDs stay out of the public repository ([environments.md](../architecture/environments.md)).

## Decision

- **`scripts/prepare-wrangler-config.mjs`** writes a gitignored config at the **repository root** (`wrangler.ci.jsonc` for deploy/preview, `wrangler.d1-nonprod.ci.jsonc` for remote non-prod migrations) by substituting placeholders before `wrangler deploy`, `wrangler preview`, or production D1 migrations. Output must be a direct child of the repo root so Wrangler resolves `main`, `assets.directory`, and `migrations_dir` correctly.
- **GitHub `preview` environment variable** `WE_MET_D1_DATABASE_ID_NONPROD` — used by the preview workflow; operators export the same value locally for `npm run db:migrate:remote`.
- **GitHub `production` environment variable** `WE_MET_D1_DATABASE_ID_PRODUCTION` — required for `--target production` (non-prod placeholder may remain in the `previews` block).
- Deploy-time guards run against the **substituted** config in CI before deploy.
- **Preview** and **d1-migrate-nonprod** prepare steps fail if the non-prod placeholder remains. **Production** prepare fails only if the production placeholder remains.

## Reasons

- Variables are not secret; D1 IDs are identifiers, not credentials.
- Splitting non-prod (`preview` environment) vs prod (`production` environment) matches [0017](./0017-cloudflare-api-credentials.md).

## Consequences

- Maintainer proof deploys use `prepare-wrangler-config.mjs` → gitignored `wrangler.ci.jsonc` with D1 IDs in env vars ([deploy-setup.md](../runbooks/deploy-setup.md)).
- `npm run db:migrate:remote` uses a minimal generated config (`--target d1-migrate-nonprod`) because `wrangler d1 migrations apply` does not read the `previews` block for remote applies.

## Amendment (2026-10-23, DIDI-683): create-if-missing D1/R2 and env validation

- **`scripts/provision-resources.mjs`** runs in deploy workflows before `prepare-wrangler-config.mjs`. It reads declared `d1_databases` and `r2_buckets` for the target (top-level for production, `previews` for non-prod, plus the matching follow-up consumer config), creates missing Cloudflare resources with Wrangler, and is idempotent on re-run.
- **D1 ID strategy (unchanged for operators):** keep GitHub environment variables `WE_MET_D1_DATABASE_ID_PRODUCTION` and `WE_MET_D1_DATABASE_ID_NONPROD` for the primary `WE_MET_DB` bindings. After provisioning, the script **validates** that each resolved D1 `database_name` has a matching env var and that the value equals the live Cloudflare id. If a new D1 is declared in Wrangler but no variable exists yet, the provision step **fails with a clear message** to add the variable (name pattern `WE_MET_D1_DATABASE_ID_<DATABASE_NAME_SLUG>_PRODUCTION` or `_NONPROD` for additional databases). `prepare-wrangler-config.mjs` is unchanged; it still substitutes placeholders from those variables.
- **Non-prod ids in logs** are masked in provision stdout; validation still uses the real env var value.
- **R2 buckets** have no GitHub variables; provision only ensures the bucket exists. Pairing of prod vs `-nonprod` names is enforced by deploy-time guards.
