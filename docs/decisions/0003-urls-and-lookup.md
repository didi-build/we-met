# 0003. Public URLs, lookup order, and a single base URL config

- **Status:** accepted
- **Date:** 2026-10-11
- **Updates:** [0014](./0014-reserved-hostnames-and-paths.md). **Amended by [0025](./0025-we-met-mvp-accounts-sign-in-and-app-backend.md)** (slug length 3–40; public lookup filters `cards.status = 'live'` and active accounts). **Amended 2026-10-17 ([DIDI-641](https://linear.app/didi-build/issue/DIDI-641)):** removed public `/hi/<slug>/contact.vcf`; owner vCard is delivered in the follow-up email after exchange only.

## Context

Cards need stable shareable links, support for a default host now and custom domains later, and consistent absolute URLs in email without hardcoded hosts.

## Decision

- Public routes: `/` (placeholder landing), `/hi/<slug>`, `/hi/<slug>/photo.jpg` (card headshot from R2), `POST /api/exchange`, `POST /api/details` ([0008](./0008-api-routes-exchange-and-details.md)).
- **Slug rules:** lowercase letters, numbers, and hyphens only; no leading or trailing hyphen; length 1–48.
- **Default card path:** **`/hi/<slug>`** on the configured host (production host: `we-met.link`).
- **Step 1 legacy mapping in this app:** `didi.build/hi` → `/hi/didi`. **`didi.build` is not redirected in step 1.**
- **Lookup order:** hostname → path (`/hi/<slug>`) → card record. Reserved hostnames and paths: [0014](./0014-reserved-hostnames-and-paths.md).
- **`WE_MET_BASE_URL`** (one value per environment) is the canonical origin for links in code and email. It is **never** derived from the incoming request host. On **previews**, `WE_MET_BASE_URL` is **`https://we-met.link`** (set in the `previews` block) so links in test emails point at production card pages.

## Reasons

- `/hi/<slug>` matches the legacy mental model and the live `didi.build/hi` path shape.
- Hostname-first lookup matches future `card.customer.com` without changing the path model.
- A single base URL prevents drift between email links, OG tags, and redirects.

## Consequences

- No hardcoded `we-met.link` or `didi.build` in application code.
- Custom domains ([DIDI-580](https://linear.app/didi-build/issue/DIDI-580)) extend lookup, not URL generation logic scattered across the app.
