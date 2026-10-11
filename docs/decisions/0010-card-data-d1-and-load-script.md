# 0010. Card data in D1; load from a gitignored file

- **Status:** accepted
- **Date:** 2026-10-11
- **Updates:** [0004](./0004-card-data-and-branding.md)

## Context

Step 1 no longer keeps card values or photos in the repo. Diadem’s real card must appear on non-prod previews and on production after load, without committing personal data.

## Decision

- **Card data seam** reads from a **D1** database (`WE_MET_DB` binding).
- **Schema (minimal):**
  - **`cards`** — unique `slug`, `variant`, contact fields, links (including footer link), page copy, photo key, `updated_at`.
  - **`hostnames`** — hostname → card for lookup.
- **No users table** in step 1; accounts, login, and an editor are out of scope.
- **No public write endpoints** in step 1 (no API to create or update cards).
- **Loading:** a script loads cards per environment from a **local, gitignored** file. An **example file with fake data** is committed. Non-prod holds Diadem’s real card for previews; production is loaded with the same script ([DIDI-584](https://linear.app/didi-build/issue/DIDI-584)).

## Reasons

- D1 matches Workers deployment and supports hostname + slug lookup.
- Gitignored load files keep PII and photos out of git while allowing repeatable deploys.

## Consequences

- Agents must not commit card field values or real photos.
- Schema and migrations land in [DIDI-573](https://linear.app/didi-build/issue/DIDI-573); load script in [DIDI-584](https://linear.app/didi-build/issue/DIDI-584).
