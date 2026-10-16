# 0014. Reserved hostnames and non-card paths

- **Status:** accepted
- **Date:** 2026-10-11
- **Updates:** [0003](./0003-urls-and-lookup.md). **Extended by [0025](./0025-we-met-mvp-accounts-sign-in-and-app-backend.md)** (reserved **slug** list at publish time; hostname reservations unchanged).

## Context

Lookup must not treat infrastructure hostnames or framework routes as card slugs.

## Decision

- **Reserved hostnames:** `app`, `www`, and `api` **never** resolve to a card (no hostname → card mapping for these).
- **Reserved paths on the card host:** the root domain’s own paths — `/`, `/api`, `/privacy`, `/terms`, and framework paths (e.g. `/_next/*`) — are **never** card slugs. Card pages live under `/hi/<slug>` only.

## Reasons

- Prevents collisions with the future app host and API surface.
- Keeps `/` as a product landing page, not a slug.

## Consequences

- Lookup implementation must check reserved names before returning a card ([DIDI-573](https://linear.app/didi-build/issue/DIDI-573)).
