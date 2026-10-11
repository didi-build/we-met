# Rollback runbook

**Purpose:** Return production to the last known-good release after a bad deploy.

## When to rollback

- Card or API errors affecting real visitors on `we-met.link`.
- Production mail or Linear creation failing after a production deploy.
- Wrong bindings detected (e.g. `we-met-followup-email-nonprod` on production): treat as incident and rollback immediately.

## Steps

1. **Identify last good release:** Git tag or commit SHA from the previous successful **production** workflow run (history added by [DIDI-572](https://linear.app/didi-build/issue/DIDI-572)).
2. **Redeploy that artifact:** Run the production deploy workflow on the known-good commit with GitHub `production` environment approval (same manual path as [deploy.md](./deploy.md)).
3. **Verify:** Card page and one read-only check on `/api/hi/*` health if exposed; confirm queue consumer metrics recover.
4. **Notify:** Note the incident in Linear and link the bad and good commits.

## Post-rollback

- Root-cause in a follow-up PR; do not hot-patch production bindings without a decision update if the seam contract changes.
- Non-prod rollback: redeploy `main` or re-run the staging workflow on an earlier green commit ([DIDI-572](https://linear.app/didi-build/issue/DIDI-572)).

## What is not decided here

- Automated instant rollback / blue-green on Workers: use manual redeploy until [DIDI-572](https://linear.app/didi-build/issue/DIDI-572) documents any faster path.
