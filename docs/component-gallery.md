# Component gallery

We Met includes a **component gallery** at `/gallery/` on a **Workers Preview** named `gallery-pr-<number>` on the existing **`we-met`** Worker script (not a separate Worker, not production deploy). It renders registered components with variants for PR review and design workflow v2.

## Who edits what

| Role          | `design/<area>/<feature>/spec.md` (design specs) | `components/` (`*.gallery.ts` registry metadata)     | `src/` (app)                          |
| ------------- | ------------------------------------------------ | ---------------------------------------------------- | ------------------------------------- |
| **Designer**  | Create and update specs (Diadem approves).       | Add gallery entries from approved specs.             | Do not edit for gallery-only work.    |
| **Developer** | Do not edit.                                     | Wire variants/props only; import app components.     | Integrate approved UI; no spec edits. |
| **QA**        | Read specs                                       | Verify gallery matches approved spec when one exists | Verify app behavior separately.       |

**Design specs live only under `design/<area>/<feature>/spec.md`.** The gallery does not host spec markdown; registry entries may link to Linear or note unspecced pipeline seeds.

## Layout

| Path          | Purpose                                                          |
| ------------- | ---------------------------------------------------------------- |
| `design/`     | Designer-owned specs (`<area>/<feature>/spec.md`)                |
| `components/` | `*.gallery.ts` metadata (variants, props, source path)           |
| `gallery/`    | Gallery SPA (registry, layout); not the Next.js app under `src/` |

## Add a component

1. Designer adds or updates `design/<area>/<feature>/spec.md` when there is an approved design.
2. Add `components/<name>/<name>.gallery.ts` that imports the app component from `src/` (no duplicated implementation).
3. Register it in `gallery/registry.ts`.
4. Run `npm run gallery:build` and open `/gallery/` locally with `npm run dev:gallery` or on a PR preview.

The site root `/` on a gallery preview URL is not the gallery; open `/gallery/` explicitly.

## Local dev

```bash
npm run dev:gallery    # Vite dev server; open /gallery/
npm run gallery:build  # static assets + dist/gallery/_headers (also in npm run check)
npm run gallery:guards
```

## PR gallery preview

Same-repo pull requests run **Gallery preview** (`.github/workflows/gallery-preview.yml`). It runs `npm run gallery:guards`, builds assets, then `wrangler preview` with `wrangler.gallery.jsonc`, `--worker-name we-met`, and `--ignore-base-config` (no D1, R2, queues, or email bindings). Preview name: `gallery-pr-<number>`.

Credentials are on the GitHub **`preview` environment** ([ADR 0017](./decisions/0017-cloudflare-api-credentials.md)): `CLOUDFLARE_API_TOKEN_NONPROD` and `CLOUDFLARE_ACCOUNT_ID` (not repository-level secrets for the token). Fork PRs skip gallery deploy.

`dist/gallery/_headers` sets `X-Robots-Tag: noindex, nofollow` for all paths on the gallery asset bundle.

See [ADR 0029](./decisions/0029-component-gallery.md).
