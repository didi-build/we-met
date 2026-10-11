# 0007. Production deploys require GitHub Environment approval

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Production touches real visitors and mail. Every production change needs a human gate, including dependency updates merged to `main`.

## Decision

- **Preview** deploys from PRs per [deploy.md](../runbooks/deploy.md) ([DIDI-572](https://linear.app/didi-build/issue/DIDI-572)).
- **Production:** a **merge to `main`** starts the production deploy job, which **waits for approval** in the GitHub **`production`** environment (one click by an authorized reviewer). Nothing reaches production without that approval, **including Dependabot merges**.
- Production migrations run as the **first step** of that approved deploy ([0011](./0011-d1-migrations.md)).

## Reasons

- Human approval catches binding mistakes and untested changes.
- Tying deploy to `main` keeps production aligned with reviewed code while preserving a hard gate.

## Consequences

- No production deploy on green CI alone; an approver must approve the `production` environment job.
- Rollback is redeploying a known-good artifact ([rollback.md](../runbooks/rollback.md)).
- Exact workflow names and commands land in [DIDI-572](https://linear.app/didi-build/issue/DIDI-572).
