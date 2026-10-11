# 0003. Public URLs, lookup order, and a single base URL config

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Cards need stable shareable links, support for a default host now and custom domains later, and consistent absolute URLs in email without hardcoded hosts.

## Decision

- Default public path: **`/p/<slug>`** on the configured host (production default: `we-met.link`).
- **Lookup order:** hostname (future custom domain) → path (`/p/<slug>`) → card record.
- **`WE_MET_BASE_URL`** (one value per environment) is the only source for canonical origin in code and templates.

## Reasons

- `/p/<slug>` is short, cache-friendly, and distinct from legacy `/hi`.
- Hostname-first lookup matches future `card.customer.com` without changing the path model.
- A single base URL prevents drift between email links, OG tags, and redirects.

## Consequences

- No hardcoded `we-met.link` or `didi.build` in application code.
- Custom domains ([DIDI-580](https://linear.app/didi-build/issue/DIDI-580)) extend lookup, not URL generation logic scattered across the app.
