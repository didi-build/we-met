# Owner relay email

Design-only spec. Approved MagicPath: [smart-light-1323](https://designs.magicpath.ai/v1/smart-light-1323), revision `464225549372502016`.

## Purpose

Send the **owner relay** email ("You met …") per exchange alongside the visitor letter ([visitor-followup](../visitor-followup/spec.md)). This message replaces today's **New lead** email and the threaded **Re:** details update email. The owner gets a reply-friendly summary with full detail rows when the visitor finishes or skips the details step (or after a timed fallback).

**Retired (do not ship):** [owner-new-lead](../owner-new-lead/spec.md), [owner-details-update](../owner-details-update/spec.md).

## Subject

`You met {visitor_full_name}` (example: `You met Sam Rivera`).

Non-prod keeps the existing `[we-met test → {sink}]` subject prefix and the **Test delivery** line in the body.

## Headers

| Header | Value |
| --- | --- |
| **From** | Platform sender address with display name from `WE_MET_FROM_DISPLAY_NAME` (ADR 0023: owners never control From) |
| **Reply-To** | Visitor email |

No threading headers. No preheader. Drop **Source** and **Received** rows from the retired templates.

## Body structure

| Block | Copy / content |
| --- | --- |
| Eyebrow | `Exchanged contacts` |
| Title | `You met {first}` (`{first}` = visitor first name) |
| Reply hint | `Hit Reply to write back. Your reply goes straight to {first}.` |
| Detail rows | Name, Email, Phone, Job title, Company, Note (see below) |
| Footer | `Sent by We Met because {first} exchanged contacts on your card · {card_url_display}` (card URL linked) |

### Detail rows

Always show **Name** and **Email**.

**Phone**, **Job title**, **Company**, and **Note** each sit in their own `{{#if}}` block. When empty, omit the row entirely: no dash, no placeholder.

Phone value links with `tel:{{lead_phone_tel}}`; email uses `mailto:`.

## Timing (CTO decision)

Send **once** per exchange (independent of the visitor letter send):

1. **Primary:** as soon as the visitor submits the details step, skips it, or closes the details sheet.
2. **Fallback:** if step 1 completed but no owner relay send yet, enqueue a delayed message **10 minutes** after exchange step 1; mark done once sent.

Daily send caps and counters count **each email** (visitor letter plus owner relay, two per exchange in both relay and direct modes).

## Mockups and templates

| Mockup | File | Meaning |
| --- | --- | --- |
| Full details | [mockups/owner-full-light.png](mockups/owner-full-light.png), [mockups/owner-full-dark.png](mockups/owner-full-dark.png) | Every optional row filled |
| Minimal | [mockups/owner-minimal-light.png](mockups/owner-minimal-light.png), [mockups/owner-minimal-dark.png](mockups/owner-minimal-dark.png) | Visitor left after step 1 only |
| Retired baseline | [mockups/owner-baseline-new-lead-light.png](mockups/owner-baseline-new-lead-light.png), [mockups/owner-baseline-new-lead-dark.png](mockups/owner-baseline-new-lead-dark.png) | Today's **New lead** email (reference) |

Approved HTML and plain text: [mockups/owner-relay.html](mockups/owner-relay.html), [mockups/owner-relay.txt](mockups/owner-relay.txt).

## Reference exports

MagicPath review component (static, not built by CI): files in [reference/](reference/) with a `.txt` suffix.

## Implementation notes

- Dev build: [DIDI-745](https://linear.app/didi-build/issue/DIDI-745) (template, timing, queue fallback).
- Wire template vars to match `src/email/email-template-vars.ts` conventions (`lead_first_name`, `lead_name`, `lead_email`, etc.).
- Remove owner **new lead** and **details update** sends from the lead sink consumer when implementing.

## Changes

- 2026-10-24: Owner relay email spec; retires new lead and details update owner emails ([DIDI-741](https://linear.app/didi-build/issue/DIDI-741)). Build: [DIDI-745](https://linear.app/didi-build/issue/DIDI-745).
