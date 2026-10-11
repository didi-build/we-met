# 0017. Separate Cloudflare API tokens for non-prod and production

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Preview workflows and production deploys need Cloudflare API access with different blast radii. The org-wide bootstrap token must never be used for routine deploys.

## Decision

- **Non-prod token:** repository secret, used by preview workflows; scoped as narrowly as Cloudflare allows (previews, non-prod D1/R2/queues).
- **Production token:** stored only as a secret on the GitHub **`production`** environment; scoped for production Worker, D1, R2, and queues.
- **Never** use **`BOOTSTRAP_TOKEN`** for We Met deploys or previews ([AGENTS.md](../../AGENTS.md)).

## Reasons

- Least privilege limits damage from a leaked CI secret.
- Production approval gate pairs with production-scoped credentials.

## Consequences

- [environments.md](../architecture/environments.md) documents secret names and scopes at a high level; [DIDI-572](https://linear.app/didi-build/issue/DIDI-572) wires workflows.
