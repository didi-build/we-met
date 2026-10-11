# 0004. Card data and branding live in the card record and token files

- **Status:** accepted
- **Date:** 2026-10-11
- **Updates:** [0010](./0010-card-data-d1-and-load-script.md), [0012](./0012-r2-images-single-ingestion.md), [0018](./0018-lead-sink.md)

## Context

Step 1 is one card; multi-user needs per-card fields and visual variants without forked layouts or one-off CSS. Card values and photos are not committed to git. Lead routing is configured per card as **zero or more sinks**.

## Decision

- **Card data seam** supplies all per-card fields (contact info, slug, variant, footer link, page copy, photo key, **enabled lead sinks**, etc.) from **D1** ([0010](./0010-card-data-d1-and-load-script.md)).
- **Lead sinks** live in **`lead_sinks`** rows keyed by `card_id` ([0018](./0018-lead-sink.md)). The seam loads sinks with the card, validates each row’s **`config`** against the schema for its **`kind`**, and exposes typed config to the app (no raw JSON outside the repository).
- **Brand variants** are a **closed set:** `green` and `mono`, stored on the card record. The variant is applied **server-side** from that record; **light/dark** mode is a **browser** preference.
- **Colors** exist only under **`src/theme/tokens/`** (e.g. `green.light.css`, `green.dark.css`; `mono.*` later). UI uses tokens, not raw color literals. A **`theme-colors`** check (to be added) will fail `npm run check` if color literals appear outside that folder.
- **Photos** are served from R2 via keys on the card record; ingestion only through the single image function ([0012](./0012-r2-images-single-ingestion.md)).
- **Email content is fixed** (no user customization). User fields in email are **short plain text**, escaped, with **no user-supplied links**.
- User-editable text in the UI is **plain text**, escaped at output boundaries.

## Reasons

- Data-driven cards scale to many users without new React trees per customer.
- Closed variants keep QA and accessibility predictable.
- Token files give one place to adjust palette per variant.
- Validated per-kind config keeps sink settings safe and evolvable.

## Consequences

- Agents must not add hex/rgb in components or inline styles for branding.
- Agents must not commit personal card data or image files.
- New variants require a decision record and token file update, not a one-off prop.
- Step 1 cards may have **no enabled sinks**; lead delivery is a no-op until step 2 implementations exist.
