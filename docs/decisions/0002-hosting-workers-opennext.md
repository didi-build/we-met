# 0002. Host on Cloudflare Workers via OpenNext with dedicated we-met resources

- **Status:** accepted
- **Date:** 2026-10-11
- **Updates:** [0009](./0009-environments-local-preview-production.md)

## Context

We Met must run as its own product on `we-met.link`, not as a route inside `didi-build/web`. We need hosting that fits a Next.js app, clear isolation from other Didi Build apps, and room for queues and consumers on the same platform.

## Decision

- Deploy the app with **OpenNext** to **Cloudflare Workers**.
- **One app Worker name:** **`we-met`** for production and for Cloudflare Previews (non-prod bindings in the Wrangler **`previews`** block; production bindings at top level). See [0009](./0009-environments-local-preview-production.md).
- Provision **dedicated `we-met-*`** queues, consumers, D1 databases, R2 buckets, and bindings per environment (see [environments.md](../architecture/environments.md)).
- **No runtime dependency** on `didi-build/web` (no shared code imports, no live calls into the monolith).

## Reasons

- Matches existing Cloudflare usage and keeps email pipeline colocated with the app.
- OpenNext supports the Next.js surface we are extracting from `/hi`.
- Separate resources prevent preview from touching production mail or leads.

## Consequences

- Infra and deploy workflows are owned in this repo ([DIDI-572](https://linear.app/didi-build/issue/DIDI-572)).
- Card data and assets load via D1 and R2 ([0010](./0010-card-data-d1-and-load-script.md), [0012](./0012-r2-images-single-ingestion.md)), not from `web`.
