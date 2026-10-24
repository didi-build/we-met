# Visitor follow-up email

Design-only spec. Approved MagicPath: [smart-light-1323](https://designs.magicpath.ai/v1/smart-light-1323), revision `464225549372502016`.

## Purpose

Email the visitor after exchange with the owner's vCard attached. **Variant B** is approved: only the promotional banner changes; letter copy, signature block, headers, and attachment behavior stay the same.

## Unchanged (variant B)

- Letter copy (greeting, body paragraphs, owner signature block).
- **From:** `{first} via We Met` (visitor-facing display name from owner first name).
- **Reply-To:** owner email.
- vCard attachment and footer disclaimer (`You're getting this because…`, `This is the only email…`).
- Non-prod test sink line and subject prefix.

## Banner change (variant B)

Replace the large promotional card with a **slim one-line dark banner** in the footer, **above** `Sent with We Met`:

- Dark pill (`#171717` background, full width within the 600px column).
- We Met mark (20px) + text **Get your own card for free** (semibold, light ink).
- **Get started** button (light pill, links to `https://we-met.link`).

### Table nesting fix

Variant B also fixes a table nesting bug in the shipped template: the old banner closed the 600px outer table early, so the letter body rendered wider than the banner on narrow viewports. Approved HTML keeps a single 600px column through the letter, disclaimer, banner, and footer.

## Mockups and templates

| Mockup | File | Meaning |
| --- | --- | --- |
| Baseline (shipped) | [mockups/visitor-baseline-light.png](mockups/visitor-baseline-light.png), [mockups/visitor-baseline-dark.png](mockups/visitor-baseline-dark.png) | Today's banner |
| Variant B | [mockups/visitor-variant-b-light.png](mockups/visitor-variant-b-light.png), [mockups/visitor-variant-b-dark.png](mockups/visitor-variant-b-dark.png) | Approved slim banner |
| Baseline HTML | [mockups/visitor-followup.baseline.html](mockups/visitor-followup.baseline.html), [mockups/visitor-followup.baseline.txt](mockups/visitor-followup.baseline.txt) | Pre-relay design export |
| Approved HTML | [mockups/visitor-followup.html](mockups/visitor-followup.html), [mockups/visitor-followup.txt](mockups/visitor-followup.txt) | Variant B templates |

Rendered previews (light, dark, non-prod): `mockups/visitor-b*.html`, `mockups/visitor-baseline*.html`, and matching `.txt` exports from the review bundle.

Variants A and C in the MagicPath review were not approved.

## Implementation notes

- Dev build: [DIDI-745](https://linear.app/didi-build/issue/DIDI-745) (sync `src/email/templates` from approved mockups per repo email template workflow).

## Changes

- 2026-10-24: Visitor follow-up banner variant B and table nesting fix ([DIDI-741](https://linear.app/didi-build/issue/DIDI-741)). Build: [DIDI-745](https://linear.app/didi-build/issue/DIDI-745).
