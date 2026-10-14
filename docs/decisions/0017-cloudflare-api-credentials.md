# 0017. Separate Cloudflare API tokens for non-prod and production

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Preview workflows and production deploys need Cloudflare API access with different blast radii. The org-wide bootstrap token must never be used for routine deploys.

## Decision

- **Non-prod token:** `CLOUDFLARE_API_TOKEN_NONPROD` on the GitHub **`preview`** environment, used by preview workflows; scoped as narrowly as Cloudflare allows (see **Token scoping** below).
- **Production token:** stored only as `CLOUDFLARE_API_TOKEN_PRODUCTION` on the GitHub **`production`** environment; scoped for production Worker deploy and D1 migrations.
- **`CLOUDFLARE_ACCOUNT_ID`:** single repository secret used by both preview and production workflows.
- **Never** use **`BOOTSTRAP_TOKEN`** for We Met deploys or previews ([AGENTS.md](../../AGENTS.md)).

## Reasons

- Least privilege limits damage from a leaked CI secret.
- Production approval gate pairs with production-scoped credentials.

## Consequences

- [environments.md](../architecture/environments.md) and [deploy.md](../runbooks/deploy.md) document secret names; [deploy-setup.md](../runbooks/deploy-setup.md) describes dashboard token names and scopes.
- Rename or create secrets in GitHub to match `CLOUDFLARE_API_TOKEN_NONPROD` and `CLOUDFLARE_API_TOKEN_PRODUCTION`; remove any unsuffixed `CLOUDFLARE_API_TOKEN` repository or environment secret.

## Token scoping (Cloudflare, 2026+)

Cloudflare supports **Worker-scoped** API tokens with the **Editor** role ([Workers granular authorization](https://blog.cloudflare.com/workers-granular-authorization)): deploy and update an existing Worker without permission to create or delete Workers or bindings. Our `wrangler.jsonc` sets `routes: [{ pattern: "we-met.link", custom_domain: true }]`, so **`opennextjs-cloudflare deploy` re-sends the custom-domain route on every production deploy** — the production CI token needs zone access on `we-met.link`, not only Worker **Editor** (verified **2026-10-11**; [deploy-setup.md](../runbooks/deploy-setup.md#first-ci-run-results)).

**Production token — zone policy (third policy):** scope **Specified Domains** → `we-met.link` only. Dashboard permissions (verified **2026-10-11**): **Workers Routes Write** and **Zone Read**. Error `The zone "we-met.link" does not exist on your account [code: 10084]` during production deploy means this policy is missing. Re-running the failed deploy job after adding the policy succeeded without updating the GitHub secret (verified **2026-10-11**).

The **non-prod** token does **not** need a zone policy: preview deploys do not touch the `we-met.link` custom domain (verified **2026-10-11**).

**D1, R2, and Queues** permissions in API tokens remain **account-level** for now (no per-database or per-bucket token scope). The production CI token therefore includes account-level **D1 Edit** (dashboard label **D1 Write**) for `wrangler d1 migrations apply`; R2 and Queues are omitted until a 403 requires them.

Previews use the **same** Worker name (`we-met`) as production. The non-prod token is scoped to that Worker only; **separation from production** is **GitHub secret placement** (`preview` vs `production` environments, plus repo-level `CLOUDFLARE_ACCOUNT_ID`) plus the **extra D1 and zone policies** on the production token only.

**Editor** scoped to Worker **`we-met`** is sufficient to **create and delete** `pr-<n>` preview instances in CI (`wrangler preview` / `preview delete`); closing or merging the first preview PR deleted preview `pr-3` successfully (verified **2026-10-11**). Wrangler may print a harmless open-beta warning for `preview delete`. If a future workflow returns **403**, grant the permission named in the error — never **Admin**.

**Production follow-up email consumer token (DIDI-599):** dashboard name **`we-met-ci-consumer`**, GitHub secret **`CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION`** on the **`production`** environment only. **Workers Editor** scoped to Worker **`we-met-followup-email-consumer`** only — do **not** widen **`we-met-ci-production`**. Add Queues or D1 permissions only if deploy returns a named 403.
