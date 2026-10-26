# Agent instructions

**Project:** We Met — Digital business cards: share your contact details in one tap and swap contacts at events, no app needed.

This file is the single source of truth for how agents work in this repository. Other agent entry points only link here.

## Before you write code

1. Read `docs/architecture/` and `docs/decisions/` for this feature.
2. If architecture or an accepted decision is missing, stop and produce a decision or architecture note first. **No implementation before the shape of the feature is decided.**

## We Met rules

Do not break these; each links to the canonical doc.

- **Theme colors** only under `src/theme/tokens/` (`npm run theme-colors` in `npm run check`): [0004](docs/decisions/0004-card-data-and-branding.md), [overview](docs/architecture/overview.md#theming).
- **`design/`** holds reference design exports and is excluded from format, lint, and the theme-colors check; do not edit it by hand.
- **No hardcoded hostnames:** use `WE_MET_BASE_URL` ([0003](docs/decisions/0003-urls-and-lookup.md)).
- **No runtime dependency on `didi-build/web`:** [0002](docs/decisions/0002-hosting-workers-opennext.md).
- **Non-prod builds never bind production** queue, consumer, D1, or R2: [0006](docs/decisions/0006-non-prod-safety.md), [environments](docs/architecture/environments.md).
- **Lead delivery** uses **`lead_sinks`** rows and per-sink queue dispatch; sink handlers are pure delivery functions and **`process-lead-sink.ts`** owns the ledger lifecycle; correlation uses opaque id-only **`external_ref`** ([0024](docs/decisions/0024-sink-agnostic-record-append-correlation.md)): [0018](docs/decisions/0018-lead-sink.md), [0023](docs/decisions/0023-owner-email-lead-sink-consumer.md).
- **App API host guard:** `/api/app/*` and `/api/auth/*` return **404** unless the request host is the production app host (`app.we-met.link`), a PR preview host (suffix `WE_MET_PREVIEW_HOST_SUFFIX`), or `localhost` / `127.0.0.1` with `WE_MET_ENV=local` ([0025](docs/decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md), `src/config/app-api-host.ts`).
- **Preview test login** (`POST /api/auth/preview-login`) is **preview-only** and must never be reachable on production or local Worker config. CI enforces this via `scripts/check-deploy-guards.mjs` and `test/app-auth/preview-login-guard.test.ts` ([0025](docs/decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)).
- **Production deploys** require GitHub **`production`** environment approval (merge to `main` starts the job): [0007](docs/decisions/0007-production-deploy-manual.md), [deploy](docs/runbooks/deploy.md).
- **Email templates are fixed**; user-supplied fields are escaped plain text: [0004](docs/decisions/0004-card-data-and-branding.md).
- **Owner email** lives only on **`accounts.email`**. Email lead sinks use config `{ "to": "account_email" }`; the app resolves that sentinel at enqueue ([0025](docs/decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)).
- **Card photos** enter only through **`ingestCardPhotoFromRequest`** (`src/images/ingest-card-photo.ts`); nothing else writes to R2 ([0012](docs/decisions/0012-r2-images-single-ingestion.md)). **`saveDraft`** updates `card_drafts.draft_json` only — it does not change `photo_key` (photo POST/DELETE only).
- **Contacts setup** uses one-time Google People API consent; **never store Google OAuth tokens** for that flow ([0026](docs/decisions/0026-contacts-setup-google-people.md)).
- **`cards:load` never targets production**; publish production cards through the app editor ([card-loading](docs/runbooks/card-loading.md), [0025](docs/decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)).
- **No personal card data or card images** in git; load from gitignored files into **local or non-prod D1 only**: [0010](docs/decisions/0010-card-data-d1-and-load-script.md).

## Component gallery

- **`specs/`** is **designer-only** (approved specs). **Developers do not edit specs.**
- **`components/`** holds gallery implementations and `*.gallery.ts` metadata. **Designers** build or update gallery components from approved specs; **developers** edit gallery components only for props or tiny non-design wiring fixes.
- **`gallery/`** is the gallery SPA (registry and layout), not the Next.js app under `src/`.
- PR previews deploy the gallery as a **separate** Worker (`gallery-preview` workflow, `wrangler.gallery.jsonc`); no D1, R2, queue, or email bindings. See [component-gallery](docs/component-gallery.md) and [0029](docs/decisions/0029-component-gallery.md).

## Engineering standards

- Prefer clean, modular boundaries; small extensions over clever hacks; readable names; minimal duplication.
- Follow this repo’s docs and config over your general habits.
- Mark unknowns as unknown. Do not guess requirements or infrastructure.
- **Docs:** write “verified” only with evidence from a named run or command and its date; otherwise keep the note UNVERIFIED. Production-only findings go as a comment on the Linear ticket (convention: comment on DIDI-564); open a docs change only when a documented claim is wrong.

## Testing

- State which seam a test covers (unit, integration, or broader).
- Pick the seam that gives confidence without bending production code to satisfy weak tests.
- Never weaken production code only to make a test pass.

## Verification

- Run `npm run check` before claiming work is done. Do not skip verification after implementation.

## Launchpad attribution

- Do **not** remove the `<!-- launchpad-attribution:start -->` … `<!-- launchpad-attribution:end -->` block in `README.md` or delete `LICENSES/launchpad-MIT.txt` unless the **repository owner** explicitly asks you to.

## Secrets

- Never commit secrets. Use `.env` locally; document variable **names** only in `.env.example`.
- Never reference, print, or move `BOOTSTRAP_TOKEN` outside `.github/workflows/bootstrap.yml` (enforced by `npm run secret-usage`).

## Scope and tickets

- The linked Linear ticket is the source of truth for scope.
- Read-only or decision-only tasks: no code, no branches, no PR — post the answer where the ticket asks.

## Pull requests

- Keep PRs small and link the Linear ticket.
- Describe what changed, why, and how you verified (include `npm run check`).
- **Open a PR and wait for human review.** Do not merge your own PR unless the ticket explicitly says **merge when green**.
- **Dependabot** dependency PRs are the exception: when CI passes, [Dependabot auto-merge](./.github/workflows/dependabot-automerge.yml) may merge them without a human review. Set repo variable `DEPENDABOT_AUTOMERGE=false` to disable.

## Commands

| Script                                       | Purpose                                                                                                                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                              | Format, lint, typecheck, email template sync + bundle guards, test, theme-colors, nodrift, gallery build, OpenNext build, app + consumer worker dry-runs, deploy guards, secrets, placeholders, attribution |
| `npm run gallery:build`                      | Vite build of the component gallery for Workers static assets (`wrangler.gallery.jsonc`)                                                                                                                    |
| `npm run dev:gallery`                        | Local Vite dev server for `/gallery`                                                                                                                                                                        |
| `npm run nodrift:check`                      | Privacy data map vs D1 migrations and Wrangler bindings (`nodrift check`)                                                                                                                                   |
| `npm run email-templates:generate`           | Regenerate `src/email/templates/generated.ts` from the six `*.html` / `*.txt` sources                                                                                                                       |
| `npm run email-templates:check`              | Fail if `generated.ts` is out of date with the template sources                                                                                                                                             |
| `npm run consumer-email-bundle:check`        | Bundle both follow-up consumers with `--outdir` and assert templates are inlined (no `node:fs`)                                                                                                             |
| `npm run theme-colors`                       | Fail if raw color literals appear outside `src/theme/tokens/`                                                                                                                                               |
| `npm run dev`                                | Next.js dev server (Turbopack)                                                                                                                                                                              |
| `npm run next:build`                         | Next.js production build (used by OpenNext)                                                                                                                                                                 |
| `npm run build`                              | OpenNext build for Cloudflare Workers                                                                                                                                                                       |
| `npm run worker:dry-run`                     | Validate Wrangler deploy without uploading (`wrangler deploy --dry-run`)                                                                                                                                    |
| `npm run worker:dry-run:generated`           | Prepare `wrangler.ci.jsonc` with dummy D1 IDs, then `wrangler deploy --dry-run` on that config                                                                                                              |
| `npm run worker:consumer-dry-run:nonprod`    | `wrangler deploy --dry-run` for `we-met-followup-email-consumer-nonprod`                                                                                                                                    |
| `npm run worker:consumer-dry-run:production` | `wrangler deploy --dry-run` for `we-met-followup-email-consumer`                                                                                                                                            |
| `npm run worker:warmup-dry-run`              | `wrangler deploy --dry-run` for `we-met-warmup-cron` (`workers/warmup/`)                                                                                                                                    |
| `npm run warmup-no-emails`                   | Fail if a non-`example.com` email appears under `workers/warmup/`                                                                                                                                           |
| `npm run deploy:guards`                      | Deploy-time binding guards on `wrangler.jsonc` and both follow-up consumer configs                                                                                                                          |
| `npm run workflow-provision-policy`          | Fail if a `pull_request` workflow runs `provision-resources.mjs` (non-prod provision is main-branch only)                                                                                                   |
| `npm run workflow-d1-id-secrets`             | Fail if a workflow passes D1 database ids via GitHub `vars.*` / `VARS.*` (case-insensitive; use environment secrets)                                                                                        |
| `npm run db:migrate`                         | Apply D1 migrations locally                                                                                                                                                                                 |
| `npm run db:migrate:remote`                  | Apply D1 migrations to remote `we-met-db-nonprod` only (never production)                                                                                                                                   |
| `npm run cards:load`                         | Load gitignored card JSON into local or remote **non-prod** D1 (`--remote`; `--production` is rejected)                                                                                                     |
| `npm run lint`                               | ESLint                                                                                                                                                                                                      |
| `npm run format`                             | Prettier write                                                                                                                                                                                              |
| `npm run format:check`                       | Prettier check                                                                                                                                                                                              |
| `npm run typecheck`                          | `tsc --noEmit`                                                                                                                                                                                              |
| `npm run test`                               | Vitest (CI uses JUnit output)                                                                                                                                                                               |
| `npm run secrets`                            | Secretlint                                                                                                                                                                                                  |
| `npm run secret-usage`                       | Fail if `BOOTSTRAP_TOKEN` appears outside `bootstrap.yml` workflows                                                                                                                                         |
| `npm run actions-policy-workflows`           | Fail if workflow `on:` triggers disagree with `.github/actions-policy-workflows.json` (GitHub Actions policy mirror)                                                                                        |
| `npm run init-project`                       | Replace `{{…}}` placeholders after creating a repo from Launchpad                                                                                                                                           |
| `npm run repo-settings`                      | Dry-run, `--apply`, or `--verify` recommended GitHub repo settings                                                                                                                                          |
| `npm run verify-action-pins`                 | Verify each pinned action SHA matches its version comment (`# vX.Y.Z`)                                                                                                                                      |

## Cursor Cloud specific instructions

- Node.js 22 (`.nvmrc`) and `npm ci` are the install. No extra system packages.
- Local dev uses two gitignored files. `.dev.vars` (from `.dev.vars.example`) sets `WE_MET_ENV=local` and `WE_MET_TOKEN_SECRET` for Wrangler bindings. `.env.local` sets `WE_MET_ENV=local` and `WE_MET_BASE_URL=https://we-met.link` so Next.js middleware can read them from `process.env`. For the exchange widget, set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to Cloudflare’s published always-pass site key `1x00000000000000000000AA`. With `WE_MET_ENV=local`, server-side Turnstile verification always passes.
- Before `/hi/didi` can return 200, run `CI=true npm run db:migrate` and `npm run cards:load -- --file data/cards.example.json`. `CI=true` makes Wrangler apply local migrations without waiting for a confirmation prompt. See [card loading](docs/runbooks/card-loading.md).
- `npm run dev` serves the app on port 3000. `npm run check` is the full local gate, including the OpenNext build and Wrangler dry-runs.
