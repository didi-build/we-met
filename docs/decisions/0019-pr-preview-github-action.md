# 0019. PR previews via GitHub Actions and `wrangler preview`

- **Status:** accepted
- **Date:** 2026-10-11

## Context

[DIDI-572](https://linear.app/didi-build/issue/DIDI-572) needs every pull request to get an isolated Cloudflare Preview on Worker `we-met`, with cleanup when the PR closes. Cloudflare offers Workers Builds (Git integration) or running `wrangler preview` in CI.

## Decision

- Use a **GitHub Actions** workflow (`.github/workflows/preview.yml`) that runs `npm run build` then `npx wrangler preview --name pr-<number>`.
- **Do not** use Cloudflare Git integration for previews in this repo.
- **Fork PRs** skip preview deploy (`head.repo` must equal `github.repository`).
- On `pull_request: closed`, the same workflow deletes the preview with `wrangler preview delete --name pr-<number>`.
- Post the preview URL with `gh pr comment` (or update a bot comment).

## Reasons

- Keeps preview logic next to deploy guards, D1 ID injection, and Turnstile build vars in one repository.
- Fork safety is explicit in GitHub `if:` conditions; Cloudflare tokens are not exposed to fork workflows.
- Matches [Cloudflare’s PR preview example](https://developers.cloudflare.com/workers/previews/examples/) without requiring Workers Builds for the app repo.

## Consequences

- Repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (non-prod-scoped token) are required for previews.
- Operators set shared preview Worker secrets once via `wrangler preview base-config secret` (documented in [deploy.md](../runbooks/deploy.md)).
