# 0017. Separate Cloudflare API tokens for non-prod and production

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Preview workflows and production deploys need Cloudflare API access with different blast radii. The org-wide bootstrap token must never be used for routine deploys.

## Decision

- **Non-prod token:** `CLOUDFLARE_API_TOKEN_NONPROD` on the GitHub **`preview`** environment, used by preview workflows; scoped as narrowly as Cloudflare allows (see **Token scoping** below).
- **Production token:** stored only as `CLOUDFLARE_API_TOKEN_PRODUCTION` on the GitHub **`production`** environment; scoped for production Worker deploy and D1 migrations.
- **`CLOUDFLARE_ACCOUNT_ID`:** single repository secret used by both preview and production workflows.
- **Never** use **`BOOTSTRAP_TOKEN`** for We Met deploys or previews ([AGENTS.md](../../AGENTS.md)).

## Reasons

- Least privilege limits damage from a leaked CI secret.
- Production approval gate pairs with production-scoped credentials.

## Consequences

- [environments.md](../architecture/environments.md) and [deploy.md](../runbooks/deploy.md) document secret names; [deploy-setup.md](../runbooks/deploy-setup.md) describes dashboard token names and scopes.
- Rename or create secrets in GitHub to match `CLOUDFLARE_API_TOKEN_NONPROD` and `CLOUDFLARE_API_TOKEN_PRODUCTION`; remove any unsuffixed `CLOUDFLARE_API_TOKEN` repository or environment secret.

## Token scoping (Cloudflare, 2026+)

Cloudflare supports **Worker-scoped** API tokens with the **Editor** role ([Workers granular authorization](https://blog.cloudflare.com/workers-granular-authorization)): deploy and update an existing Worker without permission to create or delete Workers or bindings. Route or custom-domain changes need **Editor** on the Worker plus zone **Workers Routes**; routine deploys after the maintainer proof deploy do not need zone access.

**D1, R2, and Queues** permissions in API tokens remain **account-level** for now (no per-database or per-bucket token scope). The production CI token therefore includes **D1 Edit** for `wrangler d1 migrations apply`; R2 and Queues are omitted until a 403 requires them.

Previews use the **same** Worker name (`we-met`) as production. The non-prod token is still scoped to that Worker only; **separation from production** is primarily **GitHub secret placement** (`preview` vs `production` environments, plus repo-level `CLOUDFLARE_ACCOUNT_ID`) plus the **extra D1 permission** on the production token only.

**UNVERIFIED:** Whether **Editor** scoped to `we-met` is sufficient to **create and delete** `pr-<n>` preview instances (`wrangler preview` / `preview delete`). If the first preview workflow run returns **403**, grant the permission named in the error — never **Admin**.
