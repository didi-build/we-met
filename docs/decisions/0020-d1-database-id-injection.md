# 0020. Inject D1 database IDs at deploy time from GitHub variables

- **Status:** accepted
- **Date:** 2026-10-11

## Context

`wrangler.jsonc` is committed with placeholder `database_id` values so real Cloudflare D1 UUIDs stay out of the public repository ([environments.md](../architecture/environments.md)).

## Decision

- **`scripts/prepare-wrangler-config.mjs`** writes a temporary config (under `.wrangler/ci/`, gitignored) by substituting placeholders before `wrangler deploy`, `wrangler preview`, or production D1 migrations.
- **GitHub repository variable** `WE_MET_D1_DATABASE_ID_NONPROD` — used by preview workflow and `npm run db:migrate:remote`.
- **GitHub `production` environment variable** `WE_MET_D1_DATABASE_ID_PRODUCTION` — used only by the production deploy workflow.
- Deploy-time guards run against the **substituted** config in CI before deploy.
- If any placeholder UUID remains after substitution, the prepare script **exits non-zero**.

## Reasons

- Variables are not secret; D1 IDs are identifiers, not credentials.
- Splitting non-prod (repo) vs prod (`production` environment) matches [0017](./0017-cloudflare-api-credentials.md).

## Consequences

- Local proof deploys use a gitignored `wrangler.local.jsonc` or env vars documented in [deploy.md](../runbooks/deploy.md).
- `npm run db:migrate:remote` uses a minimal generated config (`--target d1-migrate-nonprod`) because `wrangler d1 migrations apply` does not read the `previews` block for remote applies.
