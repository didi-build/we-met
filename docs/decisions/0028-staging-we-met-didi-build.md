# 0028. Staging on we-met.didi.build

- **Status:** accepted
- **Date:** 2026-10-26
- **Epic:** [DIDI-873](https://linear.app/didi-build/issue/DIDI-873) (we-met staging on we-met.didi.build)
- **Supersedes:** [0009](./0009-environments-local-preview-production.md) (Diadem's direct request on 2026-10-26 overrides 0009's "no staging" decision)
- **Updates:** [0006](./0006-non-prod-safety.md), [0007](./0007-production-deploy-manual.md), [0009](./0009-environments-local-preview-production.md), [environments.md](../architecture/environments.md)

## Context

Production deploys stay gated: a merge to `main` starts the production workflow, and an authorized approver must approve the GitHub **`production`** environment before live `we-met.link` changes. Diadem asked for a **staging** URL that always reflects the latest `main` commit **without** that approval, while production behavior stays unchanged.

Diadem (2026-10-26, ET, verbatim):

~1:16 AM: "So right now, any changes to prod, I have to approve the deploy, which is good. I need that to happen. ... on any push to main, we should have a staging. ... It should be exactly what I would see if I were to click approve deploy on the most recent requests." Correction: "we-met.didi.build".

~1:17 AM: "and the database workers etc can reuse what's set up for preview branches"

~1:18 AM: "I believe it sends all to a test account and the emails all are stamped with \"test\" (in subject, beginning of the email)"

1:21 AM: "Google sign in on staging. this should be fine since it's a static url"

**Implementation note:** Wrangler config, `deploy-staging.yml`, and related workflow changes are **out of scope for this ADR** and land in separate Linear tickets. This record is the product and operations decision; the repo may not yet contain the files described below.

## Decision

### 1. Staging Worker and bindings (no new Cloudflare resources)

- **Worker name:** `we-met-staging` (separate from production Worker `we-met` and from PR preview instances on `we-met`).
- **Custom domain:** `we-met.didi.build` (bare hostname; not a `workers.dev` preview name).
- **Bindings:** Top-level Wrangler config on `we-met-staging` uses the **same preview / non-prod resource names** as the `previews` block on `we-met`: D1 `we-met-db-nonprod`, R2 `we-met-assets-nonprod`, queue producer `we-met-followup-email-nonprod`, rate limiter namespaces **2001** (`WE_MET_EXCHANGE_RATE_LIMITER`), **2003** (`WE_MET_AUTH_RATE_LIMITER`), and **2005** (`WE_MET_APP_RATE_LIMITER`), **`IMAGES`**, and **`WORKER_SELF_REFERENCE`** pointing at Worker **`we-met-staging`**. No new D1, R2, queue, or rate-limiter resources are provisioned for staging.
- **Why not Cloudflare Preview for staging:** PR previews and version URLs are served on `<preview-name>.<pattern>` (for example `pr-<N>-we-met.<subdomain>.workers.dev`), not on a **fixed bare custom hostname**. Staging needs a stable URL (`we-met.didi.build`) on every push to `main`, so it is a dedicated Worker with a custom domain, not a Preview deployment on `we-met`.

### 2. `WE_MET_ENV=staging`

- Set on the staging app Worker (and aligned with non-prod mail rules on the shared consumer).
- **Mail:** Non-prod behavior: all outbound mail is redirected to **`WE_MET_TEST_MAIL_TO`** and stamped as test mail (subject and body), same as preview and the non-prod consumer today.
- **Google OAuth and Contacts setup:** Enabled on staging (static hostname; redirect URIs on `https://we-met.didi.build`).
- **Everything else:** Follow production configuration where safe (Turnstile widget choice, caps, feature flags, and similar), subject to non-prod data plane bindings in decision 1.

### 3. Single host for app and cards on staging

- **`/app`** (editor SPA) and **`/api/app/*`** / **`/api/auth/*`** are served on **`we-met.didi.build`**.
- There is **no** `app.we-met.didi.build` (contrast production: `we-met.link` + `app.we-met.link`).

### 4. Non-prod consumer `WE_MET_BASE_URL`

- Worker **`we-met-followup-email-consumer-nonprod`** keeps **`WE_MET_BASE_URL`** = `https://we-met.didi.build` in its committed **`wrangler.nonprod.jsonc`** `vars` (not the production card origin). Staging card and mail links use the staging hostname; production consumer vars stay on the production origin.

### 5. Discoverability and access

- Responses include **`X-Robots-Tag: noindex`** when **`WE_MET_ENV`** is not **`production`** (staging included).
- The UI shows a **visible staging banner** when **`WE_MET_ENV`** is not **`production`**.
- **No Cloudflare Access** on staging (same rationale as PR previews: agents and operators need a public URL).

### 6. Deploy workflow on push to `main`

- New workflow **`deploy-staging.yml`** runs on **every push to `main`** (same path-ignore rules as production deploy where applicable).
- Uses GitHub environment **`staging`**: **no required reviewers**, **deployment branches restricted to `main` only**.
- Applies **D1 migrations** to **`we-met-db-nonprod`** (same database as previews).
- Includes a **plan / report** step that lists migration files present on `main` that are not yet applied in production (visibility for approvers; does not replace the production plan job).
- **`deploy-production.yml`** and the **`production`** environment approval gate are **unchanged**.

### 7. Warmup and consumer deploy scope

- The **warmup** Worker (`we-met-warmup-cron`) is **never** deployed for staging.
- The **non-prod follow-up email consumer** continues to ship only via **`deploy-consumer-nonprod.yml`** (push to `main`, no approval). Staging does not add a second consumer Worker.

## Reasons

- Staging answers "what would production look like if I approved right now?" without weakening the production approval gate ([0007](./0007-production-deploy-manual.md)).
- Reusing the preview non-prod plane avoids new secrets, quotas, and drift ([0006](./0006-non-prod-safety.md)).
- A dedicated Worker + domain matches the static URL requirement for Google OAuth ([0025](./0025-we-met-mvp-accounts-sign-in-and-app-backend.md), [0026](./0026-contacts-setup-google-people.md)).

## Consequences

- Docs and runbooks describe **local**, **preview**, **staging**, and **production** ([environments.md](../architecture/environments.md), [deploy.md](../runbooks/deploy.md)).
- [0009](./0009-environments-local-preview-production.md) is historical; its rule that docs must not refer to staging no longer applies.
- Operators configure GitHub **`staging`**, token **`we-met-ci-staging`**, and Google redirect URIs on `we-met.didi.build` ([deploy-setup.md](../runbooks/deploy-setup.md)).
- Follow-up implementation tickets must add `we-met-staging` Wrangler config, deploy guards for staging, and `deploy-staging.yml` without changing the production approval path.

## Risks

- **Shared non-prod D1 schema:** [Migrate non-prod D1](../../.github/workflows/migrate-nonprod.yml) can apply migrations from open PRs before they merge to `main`. Staging and previews can run schema ahead of production until those PRs merge and production deploy applies migrations.
- **Shared non-prod data:** Staging uses the same D1 and R2 as previews: synthetic test cards, the maintainer **`didi`** card in non-prod, and **not** production data. Behavior matches preview safety (mail redirect, zero real lead sinks on non-prod cards), not a production clone.
- **Shared mail quota:** Staging mail goes through the same non-prod consumer and Cloudflare Email Service account limit (**200 messages per day** per account, per [environments.md](../architecture/environments.md)) and the **`mail.we-met.link`** sending domain as preview and local remote tests.
