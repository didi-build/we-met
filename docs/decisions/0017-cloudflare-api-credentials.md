# 0017. Separate Cloudflare API tokens for non-prod and production

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Preview workflows and production deploys need Cloudflare API access with different blast radii. The org-wide bootstrap token must never be used for routine deploys.

## Decision

- **Non-prod token:** repository secret `CLOUDFLARE_API_TOKEN_NONPROD`, used by preview workflows; scoped as narrowly as Cloudflare allows (previews, non-prod D1/R2/queues).
- **Production token:** stored only as `CLOUDFLARE_API_TOKEN_PRODUCTION` on the GitHub **`production`** environment; scoped for production Worker, D1, R2, and queues.
- **`CLOUDFLARE_ACCOUNT_ID`:** single repository secret used by both preview and production workflows.
- **Never** use **`BOOTSTRAP_TOKEN`** for We Met deploys or previews ([AGENTS.md](../../AGENTS.md)).

## Reasons

- Least privilege limits damage from a leaked CI secret.
- Production approval gate pairs with production-scoped credentials.

## Consequences

- [environments.md](../architecture/environments.md) and [deploy.md](../runbooks/deploy.md) document secret names; [DIDI-572](https://linear.app/didi-build/issue/DIDI-572) wires workflows.
- Rename or create secrets in GitHub to match `CLOUDFLARE_API_TOKEN_NONPROD` and `CLOUDFLARE_API_TOKEN_PRODUCTION`; remove any unsuffixed `CLOUDFLARE_API_TOKEN` repository or environment secret.

## Known limitation

Cloudflare API tokens can scope **Workers** permissions to specified Workers ([Workers authorization](https://developers.cloudflare.com/workers/authorization/workers/)). Deploying a Worker with D1/R2/queue bindings does not require separate permissions on those bound resources for deploy alone; direct D1/R2 API calls (for example `wrangler d1 migrations apply`) need the corresponding product permissions.

Token permission groups exposed in the [Account API](https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/subresources/permission_groups/methods/list/) include account-wide and **R2 bucket** resource scopes; **D1 database–level** token scoping is not listed there. In practice, non-prod and production tokens are still separated by GitHub secret placement and human process; they may remain **account-wide** for D1/Queues until Cloudflare offers finer scopes.
