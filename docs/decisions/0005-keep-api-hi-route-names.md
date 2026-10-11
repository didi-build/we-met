# 0005. Keep `/api/hi/*` route names for step 1

- **Status:** accepted
- **Date:** 2026-10-11

## Context

The exchange-contact flow today lives under `/hi` in `didi-build/web`, including API paths under `/api/hi/*`. Step 1 must behave identically while the UI moves to `/p/<slug>`.

## Decision

For step 1, **retain `/api/hi/*`** for the exchange-contact API (submit, validation, enqueue). Public pages use `/p/<slug>`; API paths are not renamed to `/api/we-met/*` yet.

## Reasons

- Reduces risk during extraction: clients, tests, and behavior stay aligned with the inventoryed card.
- Renaming can happen later behind a single routing change once step 1 is stable.

## Consequences

- Documentation and agents refer to `/api/hi/*` for the pipeline entrypoint in step 1.
- A future rename, if any, should be a deliberate decision with redirect or compatibility window.
