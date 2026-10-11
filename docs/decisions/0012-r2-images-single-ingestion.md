# 0012. Card images in R2 via one ingestion function

- **Status:** accepted
- **Date:** 2026-10-11
- **Updates:** [0004](./0004-card-data-and-branding.md)

## Context

Card photos must be served efficiently and safely. vCard clients need JPEG. Future editor upload will crop to a square; step 1 only defines ingestion, not the UI ([open questions](../architecture/overview.md#open-questions)).

## Decision

- **Storage:** R2 bucket behind binding **`WE_MET_ASSETS`** (`we-met-assets` production, `we-met-assets-nonprod` non-prod).
- **Single entry point:** every image enters through **one function**; nothing else writes to the bucket.
- **Input rules:** **square images only**; max **5 MB** (reject before reading the whole body into memory); types **JPEG, PNG, WebP** only.
- **Output:** re-encode to fixed **512×512 JPEG** (JPEG because vCard clients do not reliably support WebP); store under a **content-hashed** key only.
- **Implementation:** built with the Cloudflare **Images** binding ([DIDI-584](https://linear.app/didi-build/issue/DIDI-584)).

## Reasons

- One code path prevents accidental unoptimized or oversized uploads.
- Content-hashed keys enable immutable caching ([0014](./0014-cache-friendly-not-cached-yet.md)).

## Consequences

- Agents must not write to R2 outside the image function.
- No card images in git; photo keys live in D1 only.
