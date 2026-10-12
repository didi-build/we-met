# 0019. PR previews via GitHub Actions and `wrangler preview`

- **Status:** accepted
- **Date:** 2026-10-11

## Context

[DIDI-572](https://linear.app/didi-build/issue/DIDI-572) needs every pull request to get an isolated Cloudflare Preview on Worker `we-met`, with cleanup when the PR closes. Cloudflare offers Workers Builds (Git integration) or running `wrangler preview` in CI.

## Decision

- Use a **GitHub Actions** workflow (`.github/workflows/preview.yml`) that runs `npm run build` then `npx wrangler preview --name pr-<number>`.
- **Do not** use Cloudflare Git integration for previews in this repo.
- **Fork PRs** skip preview deploy (`head.repo` must equal `github.repository`).
- **Dependabot** PRs skip preview (`github.actor` is `dependabot[bot]`) because repository secrets are unavailable.
- On `pull_request: closed`, the same workflow deletes the preview with `wrangler preview delete --name pr-<number>` (cleanup uses the same fork guard as deploy; delete tolerates missing previews).
- Preview and cleanup jobs use GitHub environment **`preview`** (deploy job sets `environment.url` from the preview URL).
- Post or update the preview URL in a PR comment tagged with `<!-- we-met-preview -->` (find via GitHub API and PATCH, or create if missing).
- When a PR changes files under `migrations/`, the same comment includes a short notice to run `npm run db:migrate:remote` against shared non-prod D1 before using the preview (detected via the pulls files API; no migrations in the PR means the plain URL-only comment).
- Commit **`workers_dev`: `false`** and **`preview_urls`: `true`** in `wrangler.jsonc` so production stays on `we-met.link` while previews get workers.dev URLs.
- Considered and rejected (2026-10-11): skipping previews for docs-only PRs via paths-ignore. GitHub path filters apply per workflow, so cleanup would need its own workflow, and edge cases (PR becomes docs-only after code was reverted) leave stale previews. A redundant preview build costs about a minute of CI and is cleaned up on close, so every same-repo PR gets a preview.

## Shared non-prod D1

All PR previews bind the **same** remote D1 database **`we-met-db-nonprod`**. The preview workflow does **not** run migrations. Operators run `npm run db:migrate:remote` before opening a PR that adds a migration. Migrations must stay **backward compatible** (expand/contract) because other open previews and the last production deploy may run against the same schema.

## Reasons

- Keeps preview logic next to deploy guards, D1 ID injection, and Turnstile build vars in one repository.
- Fork safety is explicit in GitHub `if:` conditions; Cloudflare tokens are not exposed to fork workflows.
- Matches [Cloudflare’s PR preview example](https://developers.cloudflare.com/workers/previews/examples/) without requiring Workers Builds for the app repo.

## Why a `preview` environment

- **Deployment history** per PR in GitHub’s Deployments tab (same ergonomics as `production`).
- **Symmetry:** non-prod secret and variable names map 1:1 to the `preview` environment; production names stay on `production`; no repo-level fallback for preview-only values.
- **No extra protection by design:** the environment has no required reviewers and no branch restriction, because previews run on every PR push (including `refs/pull/N/merge`) and must not wait for approval. Security for these values is equivalent to repository scope.

## Consequences

- GitHub **`preview` environment** secret `CLOUDFLARE_API_TOKEN_NONPROD` and variables `WE_MET_D1_DATABASE_ID_NONPROD`, `WE_MET_TURNSTILE_SITE_KEY_NONPROD`, plus repository secret `CLOUDFLARE_ACCOUNT_ID`, are required for previews.
- Operators set shared preview Worker secrets once via `wrangler preview base-config secret` (documented in [deploy.md](../runbooks/deploy.md)).
- Non-prod Turnstile is bound to the account **workers.dev** subdomain; preview hostnames must stay on workers.dev (not custom preview domains).

## Proof deploy findings

Verified **2026-10-11** (Wrangler **4.149.0**, `@opennextjs/cloudflare` **1.20.10**), [deploy-setup.md](../runbooks/deploy-setup.md) §1.

- **`preview_urls`:** When the dashboard **Preview URLs** toggle (Worker **we-met** → Domains) is off, `wrangler preview --json` returns `"urls": []` and CI cannot read `.preview.urls[0]`. With **`preview_urls`: `true`** in config (and the toggle on), `urls[0]` is `https://<preview-name>-we-met.<account-subdomain>.workers.dev`.
- **`workers_dev`:** After the first production deploy with custom domain routes, **`workers_dev`** was off in the dashboard; pinning **`workers_dev`: `false`** in config keeps the production `*.workers.dev` URL off while previews use **`preview_urls`**. Redeploy with those pinned settings turned the dashboard **Preview URLs** toggle **on** (verified **2026-10-11**).
- **`opennextjs-cloudflare deploy --config wrangler.ci.jsonc`:** Works end to end. Log shows **“Incremental cache”** / **“Tag cache does not need populating”** for this app (no extra cache upload step required).
- **`WORKER_SELF_REFERENCE`:** Present on **production** deployments; **absent** on **preview** deployments. Whether the real card app needs the binding is **unknown until the card ships** (placeholder `/` served HTTP 200 without it).
- **`wrangler preview delete`:** Works; safe to repeat (cleanup `continue-on-error` remains for already-deleted previews).
