# 0008. Exchange API routes without `/api/hi/*`

- **Status:** accepted
- **Date:** 2026-10-11
- **Supersedes:** [0005](./0005-keep-api-hi-route-names.md)

## Context

Public card URLs move to `/hi/<slug>` (see [0003](./0003-urls-and-lookup.md)). The exchange pipeline is new to this repo; there is no need to keep monolith path names on the API.

## Decision

- **`POST /api/exchange`** — exchange submit (Turnstile, honeypot, rate limit, lead sink record, enqueue).
- **`POST /api/details`** — optional details step (signed token).

No `/api/hi/*` routes in this app.

## Reasons

- API paths are not user-facing share links; clean names match the product host.
- Avoids implying the card still lives under a `/hi` URL prefix for APIs.

## Consequences

- Documentation, runbooks, and agents use `/api/exchange` and `/api/details` only.
- Porting from `didi-build/web` maps old handlers to these routes in [DIDI-574](https://linear.app/didi-build/issue/DIDI-574).
