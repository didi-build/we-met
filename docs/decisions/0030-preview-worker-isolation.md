# 0030. Isolate PR previews on dedicated Worker we-met-preview

- **Status:** accepted
- **Date:** 2026-10-27
- **Supersedes:** [0017](./0017-cloudflare-api-credentials.md) (preview token and Worker targeting lines only)

## Context

PR preview CI previously used a token with Workers Editor on production Worker `we-met`, so a compromised PR workflow could deploy to production. Diadem chose Option 2 (DIDI-894): move PR previews to a separate preview Worker with its own scoped token ([DIDI-918](https://linear.app/didi-build/issue/DIDI-918)).

## Decision

1. **Preview Worker config:** `wrangler.preview.jsonc` names Worker `we-met-preview`, sets `workers_dev: true` and `preview_urls: true`, and binds only non-prod D1, R2, queues, rate limits, and Analytics Engine dataset **`we-met-exchange-outcome-preview`**. No routes, custom domains, or service bindings to `we-met`.
2. **Gallery previews:** `wrangler.gallery.jsonc` also targets `we-met-preview` (static assets only). PR workflow runs `wrangler preview --config wrangler.gallery.jsonc` without `--worker-name` or `--ignore-base-config`.
3. **Preview workflows:** `.github/workflows/preview.yml` and `gallery-preview.yml` use only `secrets.CLOUDFLARE_API_TOKEN_PREVIEW` on the GitHub `preview` environment. App previews run `wrangler preview --config wrangler.preview.ci.jsonc` (prepared from `wrangler.preview.jsonc`). Cleanup uses `WRANGLER_CONFIG` with `scripts/wrangler-preview-delete.mjs`.
4. **Preview host suffix:** `WE_MET_PREVIEW_HOST_SUFFIX` is `-we-met-preview.<subdomain>.workers.dev` (Worker name `we-met-preview`; preview URLs are `<preview-name>-we-met-preview.<subdomain>.workers.dev`).
5. **Guard:** `npm run preview-workflow` fails closed if a PR-triggered workflow targets production Worker `we-met`, omits the preview config, references non-preview Cloudflare tokens, or renames `preview.yml`.

## Reasons

- Token boundary limits blast radius; CI guards catch template regressions only ([Launchpad ADR 0005](https://github.com/didi-build/launchpad/blob/main/docs/decisions/0005-preview-worker-isolation.md)).
- Production `wrangler.jsonc` and staging deploy paths stay unchanged.

## Consequences

- GitHub `preview` environment needs `CLOUDFLARE_API_TOKEN_PREVIEW` (dashboard token scoped to `we-met-preview` only; manual setup in DIDI-919).
- Legacy preview dashboard tokens scoped to Worker `we-met` are retired separately ([DIDI-929](https://linear.app/didi-build/issue/DIDI-929)); workflows reference only `CLOUDFLARE_API_TOKEN_PREVIEW`.
- [0017](./0017-cloudflare-api-credentials.md) production and staging token rows remain; preview rows move here.

## Guard scope (not a security boundary)

`npm run preview-workflow` parses committed GitHub Actions YAML and Wrangler configs. The security boundary is the preview-scoped `CLOUDFLARE_API_TOKEN_PREVIEW`. The guard does not catch every possible wrangler invocation path (see Launchpad ADR 0005).
