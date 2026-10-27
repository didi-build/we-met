# 0017. Separate Cloudflare API tokens for non-prod and production

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Preview workflows and production deploys need Cloudflare API access with different blast radii. The org-wide bootstrap token must never be used for routine deploys.

## Decision

- **Preview token (superseded for PR previews by [0030](./0030-preview-worker-isolation.md)):** PR previews use `CLOUDFLARE_API_TOKEN_PREVIEW` on the **`preview`** environment, scoped to Worker **`we-met-preview`** only. Legacy dashboard tokens scoped to production Worker **`we-met`** are not used in workflows.
- **Production token:** stored only as `CLOUDFLARE_API_TOKEN_PRODUCTION` on the GitHub **`production`** environment; scoped for production Worker deploy and D1 migrations.
- **`CLOUDFLARE_ACCOUNT_ID`:** single repository secret used by both preview and production workflows.
- **Never** use **`BOOTSTRAP_TOKEN`** for We Met deploys or previews ([AGENTS.md](../../AGENTS.md)).

## Reasons

- Least privilege limits damage from a leaked CI secret.
- Production approval gate pairs with production-scoped credentials.

## Consequences

- [environments.md](../architecture/environments.md) and [deploy.md](../runbooks/deploy.md) document secret names; [deploy-setup.md](../runbooks/deploy-setup.md) describes dashboard token names and scopes.
- Rename or create secrets in GitHub to match `CLOUDFLARE_API_TOKEN_PREVIEW` (preview) and `CLOUDFLARE_API_TOKEN_PRODUCTION` (production); remove any unsuffixed `CLOUDFLARE_API_TOKEN` repository or environment secret.

## Token scoping (Cloudflare, 2026+)

Cloudflare supports **Worker-scoped** API tokens with the **Editor** role ([Workers granular authorization](https://blog.cloudflare.com/workers-granular-authorization)): deploy and update an existing Worker without permission to create or delete Workers or bindings. Our `wrangler.jsonc` sets `routes: [{ pattern: "we-met.link", custom_domain: true }]`, so **`opennextjs-cloudflare deploy` re-sends the custom-domain route on every production deploy** — the production CI token needs zone access on `we-met.link`, not only Worker **Editor** (verified **2026-10-11**; [deploy-setup.md](../runbooks/deploy-setup.md#first-ci-run-results)).

**Production token — zone policy (third policy):** scope **Specified Domains** → `we-met.link` only. Dashboard permissions (verified **2026-10-11**): **Workers Routes Write** and **Zone Read**. Error `The zone "we-met.link" does not exist on your account [code: 10084]` during production deploy means this policy is missing. Re-running the failed deploy job after adding the policy succeeded without updating the GitHub secret (verified **2026-10-11**).

The **non-prod** token does **not** need a zone policy: preview deploys do not touch the `we-met.link` custom domain (verified **2026-10-11**).

**D1, R2, and Queues** permissions in API tokens remain **account-level** for now (no per-database or per-bucket token scope). The production CI token therefore includes account-level **D1 Edit** (dashboard label **D1 Write**) for `wrangler d1 migrations apply`; R2 and Queues are omitted until a 403 requires them.

PR preview deploy and delete on Worker **`we-met-preview`** use **`CLOUDFLARE_API_TOKEN_PREVIEW`** ([0030](./0030-preview-worker-isolation.md)). Production separation is the preview Worker name, non-prod bindings in `wrangler.preview.jsonc`, and the preview-only token scope.

**Production follow-up email consumer token (DIDI-599):** dashboard name **`we-met-ci-consumer-production`**, GitHub secret **`CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION`** on the **`production`** environment only. Use **two** token policies — do **not** widen **`we-met-ci-production`**:

1. **Workers Editor** scoped to Worker **`we-met-followup-email-consumer`** only.
2. Account-level **Queues Edit** (dashboard label **Queues**, permission **Edit**). Wrangler lists queues during deploy; the first production consumer deploy in CI (**2026-10-14**) failed at the consumer step with `Authentication error [code: 10000]` on the queues list call until **Queues Edit** was added.

**Observed (2026-10-14):** a consumer deploy that includes a D1 binding did **not** require a D1 permission on this token. **Not tested:** whether **Queues Edit** is the minimal queue permission (vs a narrower scope if Cloudflare adds one).
