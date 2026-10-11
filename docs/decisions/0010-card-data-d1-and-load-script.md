# 0010. Card data in D1; load from a gitignored file

- **Status:** accepted
- **Date:** 2026-10-11
- **Updates:** [0004](./0004-card-data-and-branding.md), [0018](./0018-lead-sink.md)

## Context

Step 1 no longer keeps card values or photos in the repo. Diadem’s real card must appear on non-prod previews and on production after load, without committing personal data. The live card UI ([DIDI-574](https://linear.app/didi-build/issue/DIDI-574)), queue snapshot ([DIDI-575](https://linear.app/didi-build/issue/DIDI-575)), and follow-up email consumer ([DIDI-577](https://linear.app/didi-build/issue/DIDI-577)) all read the same card record — nothing may be hardcoded to `didi.build` URLs at runtime.

## Decision

- **Card data seam** reads from a **D1** database (`WE_MET_DB` binding).
- **Schema (minimal):**
  - **`cards`** — unique `slug`, `variant`, contact fields, **`links`** (booking URL + ordered footer nav), **`pageCopy`** (six UI strings), **`contact`** (vCard fields + `urls[]`), **`copy`** (exchange sheet, about block, follow-up email templates), photo key, `updated_at`. Stored as JSON columns `links_json`, `page_copy_json`, `contact_json`, `copy_json`. **No lead destination columns on `cards`.**
  - **`lead_sinks`** — `id`, `card_id`, `kind`, `config` (JSON text), `enabled`, `created_at`, `updated_at`. One row per sink per card ([0018](./0018-lead-sink.md)).
  - **`hostnames`** — hostname → card for lookup.
- **Single source:** the loaded card record is the source for the card page, queue message snapshot, vCard generation, and follow-up emails. **Booking and profile URLs come from `links` / `contact.urls` on the card**, not from a hardcoded host.
- **`config`:** non-secret only; validated per `kind` on every seam read/write. Auth references **`connectionId`** (future `connections` table; not designed in step 1).
- **No users table** in step 1; accounts, login, and an editor are out of scope.
- **No public write endpoints** in step 1 (no API to create or update cards).
- **Loading:** a script loads cards from a **local, gitignored** file (`data/cards.local.json`). **`data/cards.example.json`** (fake data, full shape) is committed. Run **`npm run cards:load -- --validate-only`** before any load. Non-prod holds the real card for previews; production is loaded with the same script ([DIDI-584](https://linear.app/didi-build/issue/DIDI-584)).

## Reasons

- D1 matches Workers deployment and supports hostname + slug lookup.
- Gitignored load files keep PII and photos out of git while allowing repeatable deploys.
- Normalized `lead_sinks` supports multiple destinations per card from day one.
- One typed card shape avoids duplicating copy or URLs in code when the product ships.

## Consequences

- Agents must not commit card field values or real photos.
- Schema and load validation ship in [DIDI-573](https://linear.app/didi-build/issue/DIDI-573); operator load runbook in [card-loading.md](../runbooks/card-loading.md).
