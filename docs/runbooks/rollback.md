# Rollback runbook

**Purpose:** Return production to the last known-good release after a bad deploy.

## When to rollback

- Card or API errors affecting real visitors on `we-met.link`.
- Production mail or Linear creation failing after a production deploy.
- Wrong bindings detected (e.g. `we-met-followup-email-nonprod` on production): treat as incident and rollback immediately.

## Steps

1. **Identify last good release:** Commit SHA from the previous successful [**Deploy production**](../../.github/workflows/deploy-production.yml) run on `main` (Actions tab).
2. **Redeploy that artifact:** Checkout the good commit on `main` (revert PR or cherry-pick), push, approve the **Deploy production** workflow when prompted; or re-run the workflow on the known-good SHA with `production` environment approval ([deploy.md](./deploy.md)).
3. **Verify:** Card page loads; confirm queue consumer metrics recover.
4. **Notify:** Note the incident in Linear and link the bad and good commits.

## Post-rollback

- Root-cause in a follow-up PR; do not hot-patch production bindings without a decision update if the seam contract changes.
- Preview rollback: push a fix to the PR branch (Preview workflow updates `pr-<number>`) or close the PR and open a new one.

## What is not decided here

- Automated instant rollback / blue-green on Workers: not implemented; redeploy a known-good commit via **Deploy production**.
