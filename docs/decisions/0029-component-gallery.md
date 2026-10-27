# 0029. Component gallery Workers preview alias

- **Status:** accepted
- **Date:** 2026-10-26

## Context

Design workflow v2 ([DIDI-848](https://linear.app/didi-build/issue/DIDI-848)) needs a per-repo component gallery with PR previews, separate from production app deploys. Design specs live under `design/<area>/<feature>/spec.md` (Designer only), not in the gallery tree.

## Decision

1. **Hosting:** Static React gallery (Vite) uploaded via `wrangler preview` using `wrangler.gallery.jsonc` (assets only). **Never** `wrangler deploy` with this config.
2. **Preview alias on Worker `we-met`:** Gallery uses Workers Preview name `gallery-pr-<pr-number>` on the **`we-met`** Worker script. The non-prod token is scoped to **`we-met`** only ([0017](./0017-cloudflare-api-credentials.md)), so the gallery is not a separate Worker script. This is not a production deploy; production routes and versions are unchanged.
3. **Config guards:** `wrangler.gallery.jsonc` keeps `name: "we-met"`, empty `previews: {}`, no `main`, `routes`, `vars`, or bindings. CI runs `npm run gallery:guards` in `npm run check` and in `gallery-preview.yml` before preview deploy.
4. **`--ignore-base-config`:** Skips the Cloudflare dashboard **Preview base config** for Worker `we-met` (the D1/R2/queue/vars bundle used by OpenNext app previews). Gallery deploy uses only `wrangler.gallery.jsonc` plus `--config`; app `wrangler.jsonc` is not merged in.
5. **Routes:** Gallery SPA is served at `/gallery/` on the preview hostname. The preview root `/` is not the gallery.
6. **Registry:** `components/<name>/<name>.gallery.ts` imports app components from `src/`; no duplicate CSS or shadow implementations for seeded entries.
7. **PR workflow:** `.github/workflows/gallery-preview.yml` on the **`preview` environment** (`CLOUDFLARE_API_TOKEN_PREVIEW`, `CLOUDFLARE_ACCOUNT_ID`). Deletes `gallery-pr-<n>` when the PR closes.
8. **Robots:** `wrangler.gallery.jsonc` uses `assets.directory` `./dist`; `dist/_headers` applies `X-Robots-Tag: noindex, nofollow` to `/gallery/*`, `/gallery/assets/*`, and `/*` (gallery files live under `dist/gallery/`). On `workers.dev` Preview URLs, Cloudflare adds `X-Robots-Tag: noindex` automatically ([Workers Previews: Protect Preview content](https://developers.cloudflare.com/workers/previews/custom-domains/#protect-preview-content)); `nofollow` is carried in `gallery/index.html` via `<meta name="robots" content="noindex, nofollow" />`, which CI probes on deployed previews.

## Reasons

- Reuses the existing non-prod preview token without widening scope.
- Isolates gallery assets from app preview bindings via `ignore-base-config` and an assets-only config.
- Matches Launchpad gallery UX at `/gallery/` ([DIDI-849](https://linear.app/didi-build/issue/DIDI-849)) within We Met constraints.

## Consequences

- `npm run check` includes `gallery:guards` and `gallery:build`.
- App production Worker and OpenNext preview workflow are unchanged.
- One unspecced pipeline seed (`Button` from `src/components/ui/Button.tsx`) demonstrates the registry; full migration is out of scope.
