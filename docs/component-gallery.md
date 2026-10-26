# Component gallery

We Met includes a **component gallery**: a `/gallery` route on a dedicated Cloudflare Workers preview (not the OpenNext app) that renders each registered component with its variants and props. Use it while implementing UI from approved specs and while reviewing PRs.

## Who edits what

| Role          | `specs/` (design specs)                         | `components/` (gallery implementations)                                                     |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Designer**  | Create and update specs (Diadem approves them). | Build or update gallery components from the spec after Diadem approves it.                  |
| **Developer** | Do not edit.                                    | Edit only for props or tiny non-design wiring fixes when integrating into `src/`.           |
| **QA**        | Read specs                                      | Verify gallery components match the approved spec (no second Diadem approval on components) |

The **spec directory is designer-only.** Developers wire components from the gallery into `src/` and do not change specs.

## Layout

| Path          | Purpose                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `specs/`      | Designer-owned markdown specs                                               |
| `components/` | Gallery components and `*.gallery.ts` metadata (variants, props, spec link) |
| `gallery/`    | Gallery SPA (registry, layout, styles); not the Next.js app under `src/`    |

Gallery metadata may import spec markdown at build time for display; specs remain designer-only at edit time.

## Add a component

1. Add or update the spec under `specs/<name>.md` (Designer).
2. Implement the gallery component under `components/<name>/` (Designer after approval).
3. Add `<name>.gallery.ts` exporting a `GalleryEntry` (see `components/we-met-button/we-met-button.gallery.ts`).
4. Register it in `gallery/registry.ts`.
5. Run `npm run gallery:build` and open `/gallery` locally with `npm run dev:gallery` or on a PR preview.

## Local dev

```bash
npm run dev:gallery   # Vite dev server with /gallery
npm run gallery:build # static assets for Workers (also in npm run check)
```

## PR gallery preview

Same-repo pull requests run the **Gallery preview** workflow (`.github/workflows/gallery-preview.yml`). It deploys a separate Worker preview named `gallery-pr-<number>` using `wrangler.gallery.jsonc` (no D1, R2, queues, or email bindings). The workflow comments on the PR with a link to `/gallery` when deploy and probe succeed.

Uses the same preview Cloudflare credentials as the app preview: `CLOUDFLARE_API_TOKEN_NONPROD` and `CLOUDFLARE_ACCOUNT_ID` on the `preview` GitHub environment. Fork PRs skip gallery deploy.

Responses include `X-Robots-Tag: noindex, nofollow` (via `gallery/public/_headers`).

Gallery previews use preview name `gallery-pr-<number>` on Worker `we-met` with `--ignore-base-config` and this assets-only config (token scope per [0017](./decisions/0017-cloudflare-api-credentials.md)).

See [ADR 0029](./decisions/0029-component-gallery.md).
