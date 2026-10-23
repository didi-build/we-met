# 0020. Inject D1 database IDs at deploy time from GitHub variables

- **Status:** accepted
- **Date:** 2026-10-11

## Context

`wrangler.jsonc` is committed with placeholder `database_id` values so real Cloudflare D1 UUIDs stay out of the public repository ([environments.md](../architecture/environments.md)).

## Decision

- **`scripts/prepare-wrangler-config.mjs`** writes a gitignored config at the **repository root** (`wrangler.ci.jsonc` for deploy/preview, `wrangler.d1-nonprod.ci.jsonc` for remote non-prod migrations) by substituting placeholders before `wrangler deploy`, `wrangler preview`, or production D1 migrations. Output must be a direct child of the repo root so Wrangler resolves `main`, `assets.directory`, and `migrations_dir` correctly.
- **GitHub environment secrets** `WE_MET_D1_DATABASE_ID_NONPROD` and `WE_MET_D1_DATABASE_ID_PRODUCTION` — passed into CI workflows only via `secrets.*` (never `vars.*`) so Actions does not echo database UUIDs in step env blocks. Operators export the same values locally for `npm run db:migrate:remote` and maintainer deploys.
- Deploy-time guards run against the **substituted** config in CI before deploy.
- **Preview** and **d1-migrate-nonprod** prepare steps fail if the non-prod placeholder remains. **Production** prepare fails only if the production placeholder remains.

## Reasons

- D1 IDs are identifiers, not credentials, but they are still masked in CI logs ([DIDI-793](https://linear.app/didi-build/issue/DIDI-793)).
- Splitting non-prod (`preview` environment) vs prod (`production` environment) matches [0017](./0017-cloudflare-api-credentials.md).

## Consequences

- Maintainer proof deploys use `prepare-wrangler-config.mjs` → gitignored `wrangler.ci.jsonc` with D1 IDs in env vars ([deploy-setup.md](../runbooks/deploy-setup.md)).
- `npm run db:migrate:remote` uses a minimal generated config (`--target d1-migrate-nonprod`) because `wrangler d1 migrations apply` does not read the `previews` block for remote applies.

## Amendment (2026-10-23, DIDI-683): create-if-missing D1/R2 and provision-time id handoff

- **`scripts/provision-resources.mjs`** uses the **Cloudflare REST API** (`fetch` to `api.cloudflare.com/client/v4`, see `scripts/lib/cloudflare-provision-api.mjs`) for exact-name D1/R2 lookups and creates. Pinned Wrangler in this repo does not accept `--json` on `d1 create`, `r2 bucket list`, or `r2 bucket create`; REST keeps provisioning independent of Wrangler CLI output shapes.
- **Where provision runs:** production deploy (`production` environment, `main` only) and non-prod provision in **`migrate-nonprod.yml`** apply job (`pull_request_target`, checks out **`ref: main`** only). **`preview.yml` does not provision** (PR code must not reach D1/R2 Edit tokens). `scripts/check-workflow-provision-policy.mjs` fails CI if any `pull_request` workflow references the provision script.
- **D1 id handoff (extends this ADR, does not replace it):** after provision, ids are written to gitignored **`provision-d1-ids.json`** (`{ "d1": { "<database_name>": "<uuid>" } }`) and the step sets `::add-mask::` for each id. **`prepare-wrangler-config.mjs`** reads `WE_MET_PROVISION_D1_IDS_FILE` (or the default path) and substitutes placeholders. Optional overrides **`WE_MET_D1_DATABASE_ID_PRODUCTION`** / **`WE_MET_D1_DATABASE_ID_NONPROD`** are supplied as **GitHub environment secrets** in workflows (same env var names at runtime); when both secret env and file are set for a database, they must agree. **`scripts/check-workflow-d1-id-secrets.mjs`** fails CI if a workflow uses `vars.WE_MET_D1_DATABASE_ID_*`. **D1 ids never appear in Actions logs or provision stdout** (only database/bucket names and `present`/`created`).
- **Additional databases:** primary bindings keep the two existing env var names. Further databases use `WE_MET_D1_DATABASE_ID_<SLUG>_PRODUCTION` or `_NONPROD` where `<SLUG>` is the production `database_name` with hyphens replaced by underscores (the `-nonprod` suffix is stripped before building the slug for non-prod names). Adding a database beyond the two placeholder ids still requires a **`prepare-wrangler-config.mjs`** change for new placeholders ([deploy runbook](../runbooks/deploy.md#add-a-d1-database-or-r2-bucket-pr-only)).
- **R2 buckets** have no GitHub variables; provision only ensures the bucket exists. Prod vs `-nonprod` pairing is enforced by deploy-time guards.
