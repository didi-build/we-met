# Rollback runbook

**Purpose:** Return production to the last known-good release after a bad deploy.

## When to rollback

- Card or API errors affecting real visitors on `we-met.link`.
- Production mail or Linear creation failing after a production deploy.
- Wrong bindings detected (e.g. `we-met-followup-email-nonprod` on production): treat as incident and rollback immediately.

## What rollback does and does not do

- **Code only:** Rollback reverts the **Worker deployment** to a prior version. It does **not** roll back **D1** schema or data. New migrations must stay backward compatible with the previous production deploy so a code rollback remains safe.
- **Fast path (Workers):** Cloudflare supports immediate rollback to a recent deployment via the dashboard (Deployments tab) or [`wrangler rollback`](https://developers.cloudflare.com/workers/wrangler/commands/#rollback) / [Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/). Wrangler warns that rollback does not revert bound resources (D1, R2, queues, etc.).

## Steps

1. **Identify last good release:** Commit SHA from the previous successful [**Deploy production**](../../.github/workflows/deploy-production.yml) run on `main` (Actions tab), or a known-good Worker version ID in Cloudflare.
2. **Redeploy or rollback Worker code:** Prefer `wrangler rollback` (or dashboard rollback) for speed when the previous Worker version is known good. Otherwise checkout the good commit on `main` (revert PR or cherry-pick), push, and approve **Deploy production** when prompted ([deploy.md](./deploy.md)).
3. **Verify:** Card page loads; confirm queue consumer metrics recover.
4. **Notify:** Note the incident in Linear and link the bad and good commits.

## Post-rollback

- Root-cause in a follow-up PR; do not hot-patch production bindings without a decision update if the seam contract changes.
- Preview rollback: push a fix to the PR branch (Preview workflow updates `pr-<number>`) or close the PR and open a new one.

## What is not decided here

- Automated instant rollback tied to health checks: not implemented; use Workers rollback or redeploy a known-good commit via **Deploy production**.
