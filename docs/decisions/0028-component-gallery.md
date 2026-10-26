# 0028. Component gallery on a dedicated Workers preview

- **Status:** accepted
- **Date:** 2026-10-26

## Context

Design workflow v2 ([DIDI-848](https://linear.app/didi-build/issue/DIDI-848)) needs a per-repo component gallery with PR previews, separate designer specs from implementations, and no impact on production app Workers.

## Decision

1. **Hosting:** A static React gallery built with Vite and served from a dedicated Cloudflare Worker via Wrangler **static assets** (`wrangler.gallery.jsonc`, `not_found_handling: single-page-application`). Not part of the OpenNext `we-met` Worker.
2. **Preview naming:** Gallery previews use `gallery-pr-<pr-number>` so they do not collide with app previews (`pr-<pr-number>`).
3. **Routes:** The gallery SPA lives at `/gallery` (root redirects there). Variants and props come from per-component `*.gallery.ts` beside each gallery component.
4. **Directories:** `specs/` (designer-only) and `components/` (gallery implementations: Designer builds from the approved spec; Developer edits only for props or tiny non-design wiring fixes). The gallery UI lives under `gallery/`.
5. **PR previews:** `.github/workflows/gallery-preview.yml` runs on same-repo pull requests using existing `CLOUDFLARE_API_TOKEN_NONPROD` and `CLOUDFLARE_ACCOUNT_ID` (preview environment). No new secrets. Deletes the gallery preview when the PR closes.
6. **Robots:** Gallery responses send `X-Robots-Tag: noindex, nofollow` via static asset `_headers`.
7. **Bindings:** The gallery Worker has no D1, R2, queue, KV, or email bindings.

## Reasons

- Keeps gallery deploy isolated from app preview and production Workers ([0006](./0006-non-prod-safety.md), [0019](./0019-pr-preview-github-action.md)).
- Reuses the existing non-prod preview token scope; no token widening.
- Matches the Launchpad gallery pattern ([DIDI-849](https://linear.app/didi-build/issue/DIDI-849)) adapted for We Met.

## Consequences

- `npm run check` includes `npm run gallery:build`.
- App `wrangler.jsonc` and production behavior are unchanged.
- One seeded component (`WeMetButton`) demonstrates the pattern; migrating all UI is out of scope.
