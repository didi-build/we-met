# Exchange and details sheets

Design-only spec. Approved MagicPath: [smart-light-1323](https://designs.magicpath.ai/v1/smart-light-1323), revision `464225549372502016`.

## Purpose

Move **Phone** from the exchange sheet (step 1) to the details sheet (step 2). Step 1 stays minimal (name and email only); step 2 collects optional phone plus existing optional fields.

## Exchange sheet (step 1)

**Title:** `Let's stay in touch`

| Field | Required | Notes |
| --- | --- | --- |
| Full name | Yes | Same validation and error copy as today |
| Email | Yes | Same validation and error copy as today |

**Removed:** Phone field and country code control.

**Unchanged:** Primary button **Exchange contact**, consent line, sticky bar behavior, and sheet chrome (grabber, close).

## Details sheet (step 2)

**Title:** `Nice to meet you, {first}`

**Intro:** `Add a few details to help me remember you.` (unchanged)

Field order:

1. **Phone** (new position): same control as today's exchange phone: country code `<select>` plus `type="tel"` input with `autocomplete="tel-national"`. No `(optional)` hint (all details fields are optional).
2. Job title
3. Company
4. Note

**Unchanged:** **Save details** button, errors, skip/close behavior.

## Mockups

| Mockup | File | Meaning |
| --- | --- | --- |
| Exchange baseline | [mockups/exchange-baseline-light.png](mockups/exchange-baseline-light.png), [mockups/exchange-baseline-dark.png](mockups/exchange-baseline-dark.png) | Today: name, email, phone |
| Exchange updated | [mockups/exchange-updated-light.png](mockups/exchange-updated-light.png), [mockups/exchange-updated-dark.png](mockups/exchange-updated-dark.png) | Name and email only |
| Details baseline | [mockups/details-baseline-light.png](mockups/details-baseline-light.png), [mockups/details-baseline-dark.png](mockups/details-baseline-dark.png) | Today: no phone |
| Details updated | [mockups/details-updated-light.png](mockups/details-updated-light.png), [mockups/details-updated-dark.png](mockups/details-updated-dark.png) | Phone first |

Static HTML previews: `mockups/details-updated.html`, `mockups/details-updated.dark.html`, `mockups/details-updated.txt`.

Interactive reference: [design/card/card.html](../card.html) (update on implementation); MagicPath form exports live under [../../emails/owner-relay/reference/](../../emails/owner-relay/reference/) (`forms.tsx.txt`).

## Build notes

- Keep `phone` **nullable** on `VisitorLead` and on the queue message so already-queued messages still parse.
- Add optional `phone` to the **details** API: 40 character limit plus existing control-character check; store/send as `<dial> <national>` via `formatHiPhone` (same as today's exchange step).
- Details step is **one-shot**: a visitor who skips step 2 cannot add a phone later in the same exchange session.
- Exchange step 1 API should stop accepting phone (or ignore it) once implemented.

## Implementation notes

- Dev build: [DIDI-751](https://linear.app/didi-build/issue/DIDI-751).
- Coordinate with [owner-relay](../../emails/owner-relay/spec.md) timing: relay send waits for details submit, skip, close, or 10 minute fallback.

## Changes

- 2026-10-24: Phone moves from exchange sheet to details sheet ([DIDI-741](https://linear.app/didi-build/issue/DIDI-741)). Build: [DIDI-751](https://linear.app/didi-build/issue/DIDI-751).
