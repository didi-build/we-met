# 0002. Host on Cloudflare Workers via OpenNext with dedicated we-met resources

- **Status:** accepted
- **Date:** 2026-10-11

## Context

We Met must run as its own product (planned production domain `we-met.link`, not owned yet), not as a route inside `didi-build/web`. We need hosting that fits a Next.js app, clear isolation from other Didi Build apps, and room for queues and consumers on the same platform.

## Decision

- Deploy the app with **OpenNext** to **Cloudflare Workers**.
- Use Wrangler environments: staging app Worker **`we-met-staging`** (`we-met.didi.build`); production app Worker **`we-met`** (`we-met.link` when live).
- Provision **dedicated `we-met-*`** queues, consumers, and bindings per environment (see [environments.md](../architecture/environments.md)).
- **No runtime dependency** on `didi-build/web` (no shared code imports, no live calls into the monolith).

## Reasons

- Matches existing Cloudflare usage and keeps email pipeline colocated with the app.
- OpenNext supports the Next.js surface we are extracting from `/hi`.
- Separate resources prevent preview/staging from touching production mail or leads.

## Consequences

- Infra and deploy workflows are owned in this repo ([DIDI-572](https://linear.app/didi-build/issue/DIDI-572)).
- Card data and assets must be self-contained or loaded via the card-data seam, not from `web`.
