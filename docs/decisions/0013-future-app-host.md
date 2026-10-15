# 0013. Future authenticated app at `app.we-met.link`

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Multi-user accounts and an editor are backlog ([DIDI-581](https://linear.app/didi-build/issue/DIDI-581)). Host and cookie boundaries must be decided before auth ships.

## Decision

- **Public cards** stay on **`we-met.link`** (`/hi/<slug>`, etc.).
- **Authenticated app** (accounts, editor, uploads) will live at **`app.we-met.link`**.
- **One Worker** (`we-met`) serves both hosts until there is a reason to split.
- When auth arrives, **session cookies are host-only on `app.we-met.link`**, never on the parent domain, so user-supplied card pages on `we-met.link` cannot access a session.

## Reasons

- Separating app and card origins is a standard pattern for XSS and cookie isolation on user-influenced HTML.
- One Worker avoids premature operational split.

## Consequences

- **Not built in step 1** — record only.
- Turnstile production keys cover `we-met.link` and `app.we-met.link` ([environments.md](../architecture/environments.md)).

## Implementation (DIDI-610)

- **`app.we-met.link`** is routed on the same Worker (`wrangler.jsonc` custom domain).
- **Host-aware root:** Next.js middleware rewrites `app.we-met.link/` to an internal `/app-coming-soon` page (coming-soon placeholder). The card host `we-met.link/` serves the product landing page. `/app-coming-soon` returns 404 on the card host.
- **`/hi/<slug>`** cache headers and behavior are unchanged on both hosts.
