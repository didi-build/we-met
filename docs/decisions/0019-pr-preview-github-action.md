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
- On `pull_request: closed`, the same workflow deletes the preview with `wrangler preview delete --name pr-<number>` (cleanup uses the same `if:` guards as deploy; delete tolerates missing previews).
- Post or update the preview URL in a PR comment tagged with `<!-- we-met-preview -->` (find via GitHub API and PATCH, or create if missing).
- Commit **`workers_dev`: `false`** and **`preview_urls`: `true`** in `wrangler.jsonc` so production stays on `we-met.link` while previews get workers.dev URLs.

## Shared non-prod D1

All PR previews bind the **same** remote D1 database **`we-met-db-nonprod`**. The preview workflow does **not** run migrations. Operators run `npm run db:migrate:remote` before opening a PR that adds a migration. Migrations must stay **backward compatible** (expand/contract) because other open previews and the last production deploy may run against the same schema.

## Reasons

- Keeps preview logic next to deploy guards, D1 ID injection, and Turnstile build vars in one repository.
- Fork safety is explicit in GitHub `if:` conditions; Cloudflare tokens are not exposed to fork workflows.
- Matches [Cloudflare’s PR preview example](https://developers.cloudflare.com/workers/previews/examples/) without requiring Workers Builds for the app repo.

## Consequences

- Repository secrets `CLOUDFLARE_API_TOKEN_NONPROD` and `CLOUDFLARE_ACCOUNT_ID` (non-prod-scoped token) are required for previews.
- Operators set shared preview Worker secrets once via `wrangler preview base-config secret` (documented in [deploy.md](../runbooks/deploy.md)).
- Non-prod Turnstile is bound to the account **workers.dev** subdomain; preview hostnames must stay on workers.dev (not custom preview domains).

## Proof deploy findings

Verified **2026-10-11** (Wrangler **4.149.0**, `@opennextjs/cloudflare` **1.20.10**), [deploy-setup.md](../runbooks/deploy-setup.md) §1.

- **`preview_urls`:** When the dashboard **Preview URLs** toggle (Worker **we-met** → Domains) is off, `wrangler preview --json` returns `"urls": []` and CI cannot read `.preview.urls[0]`. With **`preview_urls`: `true`** in config (and the toggle on), `urls[0]` is `https://<preview-name>-we-met.<account-subdomain>.workers.dev`.
- **`workers_dev`:** After the first production deploy with custom domain routes, **`workers_dev`** was off in the dashboard; pinning **`workers_dev`: `false`** in config keeps the production `*.workers.dev` URL off while previews use **`preview_urls`**. Redeploy with those pinned settings turned the dashboard **Preview URLs** toggle **on** (verified **2026-10-11**).
- **`opennextjs-cloudflare deploy --config wrangler.ci.jsonc`:** Works end to end. Log shows **“Incremental cache”** / **“Tag cache does not need populating”** for this app (no extra cache upload step required).
- **`WORKER_SELF_REFERENCE`:** Present on **production** deployments; **absent** on **preview** deployments. Whether the real card app needs the binding is **unknown until the card ships** (placeholder `/` served HTTP 200 without it).
- **`wrangler preview delete`:** Works; safe to repeat (cleanup `continue-on-error` remains for already-deleted previews).
