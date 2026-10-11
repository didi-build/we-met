# 0010. Card data in D1; load from a gitignored file

- **Status:** accepted
- **Date:** 2026-10-11
- **Updates:** [0004](./0004-card-data-and-branding.md), [0018](./0018-lead-sink.md)

## Context

Step 1 no longer keeps card values or photos in the repo. Diadem’s real card must appear on non-prod previews and on production after load, without committing personal data.

## Decision

- **Card data seam** reads from a **D1** database (`WE_MET_DB` binding).
- **Schema (minimal):**
  - **`cards`** — unique `slug`, `variant`, contact fields, links (including footer link), page copy, photo key, **`lead_destination_kind`**, **`lead_destination_config`** (non-secret JSON for the sink), `updated_at`.
  - **`hostnames`** — hostname → card for lookup.
- **Lead destination:** `lead_destination_kind` is e.g. `"none"` in step 1; `lead_destination_config` holds implementation-specific **non-secret** fields only ([0018](./0018-lead-sink.md)).
- **No users table** in step 1; accounts, login, and an editor are out of scope.
- **No public write endpoints** in step 1 (no API to create or update cards).
- **Loading:** a script loads cards per environment from a **local, gitignored** file. An **example file with fake data** is committed. Non-prod holds Diadem’s real card for previews; production is loaded with the same script ([DIDI-584](https://linear.app/didi-build/issue/DIDI-584)).

## Reasons

- D1 matches Workers deployment and supports hostname + slug lookup.
- Gitignored load files keep PII and photos out of git while allowing repeatable deploys.
- Storing lead destination on the row keeps LeadSink resolution in the card-data seam.

## Consequences

- Agents must not commit card field values or real photos.
- Schema and migrations land in [DIDI-573](https://linear.app/didi-build/issue/DIDI-573); load script in [DIDI-584](https://linear.app/didi-build/issue/DIDI-584).
