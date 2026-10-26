# 0029. Component gallery on a dedicated Workers preview

- **Status:** accepted
- **Date:** 2026-10-26

## Context

Design workflow v2 ([DIDI-848](https://linear.app/didi-build/issue/DIDI-848)) needs a per-repo component gallery with PR previews, separate designer specs from implementations, and no impact on production app Workers.

## Decision

1. **Hosting:** A static React gallery built with Vite and served via Wrangler **static assets** (`wrangler.gallery.jsonc`, `not_found_handling: single-page-application`). Not part of the OpenNext app bundle or production deploy.
2. **Preview naming and Worker target:** Gallery previews use name `gallery-pr-<pr-number>` (separate URL from app previews `pr-<pr-number>`). The non-prod API token is scoped to Worker **`we-met`** only ([0017](./0017-cloudflare-api-credentials.md)), so gallery preview deploy uses `--worker-name we-met` and `--ignore-base-config` with the assets-only gallery config (no inherited D1, R2, queue, or email bindings from the app preview base config).
3. **Preview URLs:** `preview_urls: true` and `workers_dev: false` in `wrangler.gallery.jsonc` so `wrangler preview --json` returns a workers.dev URL ([0019](./0019-pr-preview-github-action.md)).
4. **Routes:** The gallery SPA lives at `/gallery` (root redirects there). Variants and props come from per-component `*.gallery.ts` beside each gallery component.
5. **Directories:** `specs/` (designer-only) and `components/` (gallery implementations: Designer builds from the approved spec; Developer edits only for props or tiny non-design wiring fixes). The gallery UI lives under `gallery/`.
6. **PR previews:** `.github/workflows/gallery-preview.yml` runs on same-repo pull requests using existing `CLOUDFLARE_API_TOKEN_NONPROD` and `CLOUDFLARE_ACCOUNT_ID` (preview environment). No new secrets. Deletes the gallery preview when the PR closes.
7. **Robots:** Gallery responses send `X-Robots-Tag: noindex, nofollow` via static asset `_headers`.
8. **Bindings:** Gallery preview deployments have no D1, R2, queue, KV, or email bindings.

## Reasons

- Keeps gallery deploy isolated from app preview and production Workers ([0006](./0006-non-prod-safety.md), [0019](./0019-pr-preview-github-action.md)).
- Reuses the existing non-prod preview token scope; no token widening.
- Matches the Launchpad gallery pattern ([DIDI-849](https://linear.app/didi-build/issue/DIDI-849)) adapted for We Met.

## Consequences

- `npm run check` includes `npm run gallery:build`.
- App `wrangler.jsonc` and production behavior are unchanged.
- One seeded component (`WeMetButton`) demonstrates the pattern; migrating all UI is out of scope.
