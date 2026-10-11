# 0003. Public URLs, lookup order, and a single base URL config

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Cards need stable shareable links, support for a default host now and custom domains later, and consistent absolute URLs in email without hardcoded hosts.

## Decision

- Public routes: `/` (placeholder landing), `/p/<slug>`, `/p/<slug>/contact.vcf` (inline vCard), `POST /api/hi/exchange`, `POST /api/hi/details`.
- **Slug rules:** lowercase letters, numbers, and hyphens only; no leading or trailing hyphen; length 1–48.
- Default card path: **`/p/<slug>`** on the configured host (planned production host: `we-met.link`).
- **Step 1 legacy mapping in this app:** `/hi` → `/p/didi`; `/hi/contact.vcf` → `/p/didi/contact.vcf`; `/api/hi/*` unchanged. **`didi.build` is not redirected in step 1.**
- **Lookup order:** hostname → path (`/p/<slug>`) → card record. Step 1 has **one** card (`didi`). Preview and staging hosts resolve to that card through **configuration**, never hardcoded hostnames.
- **`WE_MET_BASE_URL`** (one value per environment) is the canonical origin for links in code and email.

## Reasons

- `/p/<slug>` is short, cache-friendly, and distinct from legacy `/hi`.
- Hostname-first lookup matches future `card.customer.com` without changing the path model.
- A single base URL prevents drift between email links, OG tags, and redirects.

## Consequences

- No hardcoded `we-met.link` or `didi.build` in application code.
- Custom domains ([DIDI-580](https://linear.app/didi-build/issue/DIDI-580)) extend lookup, not URL generation logic scattered across the app.
