# 0004. Card data and branding live in the card record and token files

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Step 1 is one card; multi-user needs per-card fields and visual variants without forked layouts or one-off CSS.

## Decision

- **Card data seam** supplies all per-card fields (contact info, slug, variant, footer link, etc.).
- **Brand variants** are a **closed set:** `green` and `mono`, stored on the card record.
- **Colors** exist only in **theme token files**; UI uses tokens, not raw color literals.
- User-editable text in email and UI is **plain text**, escaped at output boundaries.

## Reasons

- Data-driven cards scale to many users without new React trees per customer.
- Closed variants keep QA and accessibility predictable.
- Token files give one place to adjust palette per variant.

## Consequences

- Agents must not add hex/rgb in components or inline styles for branding.
- New variants require a decision record and token file update, not a one-off prop.
