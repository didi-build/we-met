# 0011. D1 migrations: shared non-prod, gated production

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Previews and local remote development share the **non-prod** D1 database (`we-met-db-nonprod`). Production uses `we-met-db`. Schema changes must not brick previews or production.

## Decision

- Migrations live in **`migrations/`** and are applied with the repo migration script (see [AGENTS.md](../../AGENTS.md) Commands).
- **Non-prod:** previews share one scratch database; the load script can rebuild data after additive changes. **Additive** migrations may be applied to non-prod from a PR (**same-repo branches only**, never forks).
- **Production:** migrations run only as the **first step** of an approved production deploy ([0007](./0007-production-deploy-manual.md)).
- **Breaking schema changes:** use Cloudflare’s **per-branch database override** so a PR can test incompatible schema without touching shared non-prod until merged.

## Reasons

- Shared non-prod keeps preview cost low while staying close to production shape.
- Gating production migrations behind deploy approval prevents accidental schema drift.

## Consequences

- CI/deploy guards must not apply production migrations without the `production` GitHub environment.
- Fork PRs do not get permission to migrate shared non-prod remotely.
