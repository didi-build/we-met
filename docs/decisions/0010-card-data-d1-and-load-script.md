# 0010. Card data in D1; load from a gitignored file

- **Status:** accepted
- **Date:** 2026-10-11
- **Updates:** [0004](./0004-card-data-and-branding.md), [0018](./0018-lead-sink.md)

## Context

Step 1 no longer keeps card values or photos in the repo. Diadem’s real card must appear on non-prod previews and on production after load, without committing personal data.

## Decision

- **Card data seam** reads from a **D1** database (`WE_MET_DB` binding).
- **Schema (minimal):**
  - **`cards`** — unique `slug`, `variant`, contact fields, links (including footer link), page copy, photo key, `updated_at`. **No lead destination columns on `cards`.**
  - **`lead_sinks`** — `id`, `card_id`, `kind`, `config` (JSON text), `enabled`, `created_at`, `updated_at`. One row per sink per card ([0018](./0018-lead-sink.md)).
  - **`hostnames`** — hostname → card for lookup.
- **`config`:** non-secret only; validated per `kind` on every seam read/write. Auth references **`connectionId`** (future `connections` table; not designed in step 1).
- **No users table** in step 1; accounts, login, and an editor are out of scope.
- **No public write endpoints** in step 1 (no API to create or update cards).
- **Loading:** a script loads cards and **`lead_sinks`** per environment from a **local, gitignored** file. An **example file with fake data** is committed. Non-prod holds Diadem’s real card for previews; production is loaded with the same script ([DIDI-584](https://linear.app/didi-build/issue/DIDI-584)).

## Reasons

- D1 matches Workers deployment and supports hostname + slug lookup.
- Gitignored load files keep PII and photos out of git while allowing repeatable deploys.
- Normalized `lead_sinks` supports multiple destinations per card from day one.

## Consequences

- Agents must not commit card field values or real photos.
- Schema and migrations land in [DIDI-573](https://linear.app/didi-build/issue/DIDI-573); load script in [DIDI-584](https://linear.app/didi-build/issue/DIDI-584).
