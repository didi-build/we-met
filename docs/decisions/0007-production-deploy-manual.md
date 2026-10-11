# 0007. Production deploys are manual with GitHub Environment approval

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Production touches real visitors, mail, and Linear. Automated production deploys from every `main` merge are too risky for step 1.

## Decision

- **Staging** (and preview) deploy from **`main`** / PRs per [deploy.md](../runbooks/deploy.md).
- **Production** deploys are **manual** workflow runs gated by the GitHub **`production` environment** with **required reviewers**.

## Reasons

- Human approval catches binding mistakes and untested changes.
- Staging still gives continuous verification on `main`.

## Consequences

- No production deploy on green CI alone; an approver must trigger and approve.
- Rollback is redeploying a known-good artifact ([rollback.md](../runbooks/rollback.md)).
- Exact workflow names and commands land in [DIDI-572](https://linear.app/didi-build/issue/DIDI-572).
