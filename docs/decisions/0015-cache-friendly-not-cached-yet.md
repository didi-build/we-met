# 0015. Cache-friendly responses; caching deferred

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Cards and images should be cheap to serve at scale. Full CDN caching is follow-up work ([DIDI-585](https://linear.app/didi-build/issue/DIDI-585)).

## Decision

- **Images:** content-hashed keys; served with `Cache-Control: public, max-age=31536000, immutable`.
- **Card HTML:** pure function of host, path, and card record — **no per-request randomness** in the HTML. Every response sets an explicit **`Cache-Control`**. `cards.updated_at` exists for future ETags and invalidation.
- **Caching itself** is not enabled in step 1; behavior is “cache-friendly, not cached yet.”

## Reasons

- Headers and deterministic HTML avoid rework when caching is turned on.
- `updated_at` gives a natural invalidation signal later.

## Consequences

- Implementers set `Cache-Control` on all card and asset responses even before edge cache rules exist.
