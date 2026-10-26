# 0009. Three environments: local, preview, and production

- **Status:** superseded by [0028](./0028-staging-we-met-didi-build.md)
- **Date:** 2026-10-11
- **Updates:** [0002](./0002-hosting-workers-opennext.md), [0006](./0006-non-prod-safety.md)

## Context

Early docs assumed a **staging** Worker (`we-met-staging`, `we-met.didi.build`). Step 1 instead uses Cloudflare **Previews** on the production Worker name with a `previews` block, plus local development. Production exists before cutover but is not linked publicly until [DIDI-566](https://linear.app/didi-build/issue/DIDI-566).

## Decision

- **Environments:** `local`, `preview`, and `production` only. There is **no staging** environment or `we-met-staging` Worker.
- **App Worker:** `we-met` in all cases. Production bindings sit at the top level of Wrangler config; **non-prod bindings** sit in the **`previews`** block (previews do not inherit production settings).
- **Preview:** every PR gets a Cloudflare Preview under `we-met` with non-prod queue, consumer, D1, R2, and rate limiter only.
- **Production:** deployed to the same Worker name with production bindings; live on `we-met.link` when cut over.
- **`WE_MET_ENV`:** `local` | `preview` | `production`.

## Reasons

- One Worker and one config reduce drift between “almost prod” and prod.
- Previews isolate per PR while sharing one non-prod data plane ([environments.md](../architecture/environments.md)).

## Consequences

- Docs and runbooks must not refer to staging, `we-met-staging`, or `we-met.didi.build`. **Superseded (2026-10-26):** [0028](./0028-staging-we-met-didi-build.md) reintroduces staging; this bullet no longer applies.
- Local dev uses non-prod binding names (same resources previews use for remote D1/R2 when not emulated locally).
