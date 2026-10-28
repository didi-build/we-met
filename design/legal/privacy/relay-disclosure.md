# Legal: privacy page, relay mode disclosure

Design-only section spec for the We Met privacy page (`/privacy`, `src/components/landing/PrivacyPolicyContent.tsx`). Copy only: no layout or behaviour change. Ticket: [DIDI-920](https://linear.app/didi-build/issue/DIDI-920). Dev: [DIDI-921](https://linear.app/didi-build/issue/DIDI-921).

**Approved by Diadem, Oct 27, 2026, 4:13 PM ET ([DIDI-920](https://linear.app/didi-build/issue/DIDI-920)). Any edit to this text needs a fresh approval.**

This file sits next to the privacy page spec ([spec.md](spec.md)), which links here; it is listed in `design/README.md`. See also [visitor-receipt-disclosure.md](visitor-receipt-disclosure.md) (DIDI-923).

## Purpose

The section "What the people you meet can see" describes only the direct-mode follow-up email sent "via We Met". Relay mode is the default, and in relay the visitor gets the owner's letter and contact card (with the owner's Google account email address) when the owner hits Reply. The page should say so.

## Product direction

> "Yes, have Designer draft a relay-mode privacy disclosure for my approval"

Diadem, Oct 27, 2026, 3:57 PM ET, verbatim (DIDI-920). **Matches Product direction: yes.**

## What the visitor receives in relay mode (checked against main dfeee96 (src unchanged since f19c6b6))

In direct mode, We Met emails the follow-up letter to the visitor, with From display name built from the owner's given name (`{first} via We Met`), and Reply-To set to the owner's Google account email (`src/followup-email-consumer/process-batch.ts` 313 to 326).

| # | Item | Reference |
| --- | --- | --- |
| 1 | Relay (`owner_relay`) is the default; missing or unknown setting means relay. | ADR 0027, Decision 2 and 3; `src/app-settings/defaults.ts` |
| 2 | We Met emails the visitor nothing in relay. The "Great meeting you, {first}" letter goes to the owner. | ADR 0027, Decision 4; `src/followup-email-consumer/process-batch.ts` 298 to 312 |
| 3 | The letter goes to the owner's Google account email address (the card's `email` is `accounts.email`). | `process-batch.ts` 299 to 304; `src/card-data/d1-repository.ts` 22; `src/card-data/card-persist.ts` 181 |
| 4 | From: the We Met sending address, display name "We Met" (or the configured display name). Reply-To: the visitor. | `process-batch.ts` 290 to 291, 305 to 310; `src/email/from-display-name.ts` 63 |
| 5 | Letter body: "Hi {first}", "Great meeting you, and thanks for sharing your details with me.", a "Save my contact card" link (when a token is present), the owner's signature name (given, nickname in brackets, family), role (title and company), photo (a we-met.link image URL), footer with the card URL, the "Get your own card for free" banner and "Sent with We Met". | `src/email/templates/visitor-followup.html` 40 to 76; `src/email/format-visitor-follow-up.ts` 47 to 66; `src/email/owner-email-display-name.ts` 8 to 21 |
| 6 | The .vcf is always attached, in both modes. Relay adds the save link on top. | `process-batch.ts` 329 to 336, 362 to 385; ADR 0027 addendum, Decision 1 and 6 |
| 7 | vCard contents: full name, nickname, company, title, the owner's Google account email, phone if added, photo if JPEG, card links, card note. | `src/lib/hi/vcard.ts` 54 to 90; `src/lib/hi/build-owner-vcard.ts` 41 |
| 8 | When the owner hits Reply, the reply is sent by the owner's own mail provider, from the owner's own inbox, to the visitor (Reply-To). We Met is not in that send. | ADR 0027, Decision 4; landing relay spec, Q2 and Q4 |
| 9 | The save link (`GET /api/exchange/<leadId>/contact-card?token=...`) returns the owner's **current** card while the card is live with one enabled email sink. The token never expires and works for anyone holding the link. | ADR 0027 addendum, Decision 2 and 4; `src/exchange/process-exchange-contact-card.ts` 53 to 76; `src/card-data/live-card.ts` 8 to 17 |
| 10 | We Met logs each save link download with the exchange id only; a relay letter without a link logs exchange id and card id. | `src/exchange/runtime.ts` 174; `process-batch.ts` 346 to 351; ADR 0027 addendum, Decision 5 |
| 11 | The token is in the query string, so it may appear in Cloudflare request logs, browser history and mail security scanners. Workers logs are on. | ADR 0027 addendum, Decision 4; `wrangler.jsonc` 87 to 92 |
| 12 | Cloudflare Email Service carries the letter (with the .vcf) to the owner; Email preview, if on, keeps full messages about seven days. | `src/email/cloudflare-sender.ts` 45 to 51, 102 to 103; `docs/privacy/subprocessors.md` 8, 19 |
| 13 | We Met keeps no letter text; only delivery records (`visitor_letter_claimed_at`, `visitor_letter_sent_at`). | ADR 0027, Migration 0009; privacy page lines 34 to 35, 60 |

UNKNOWN (not decidable from code):
- Whether the owner's mail app keeps the quoted letter, the photo and the .vcf when they hit Reply (ADR 0027 addendum, Context: Gmail and Outlook often drop the attachment).
- Which address the owner replies from (normally their Google account address, but aliases or other clients are possible).
- Whether Reply All in the owner's mail app also addresses the We Met sending address.
- Cloudflare request log retention for save link URLs.

Not disclosed on the current page: items 2, 3, 5, 7 and 9 in relay terms. Line 65 ("By default, we don't email them your contact card or your Google account email address") is literally true but leaves out that the owner's Reply delivers both.

## Final copy

Section "What the people you meet can see" in `src/components/landing/PrivacyPolicyContent.tsx`. Placement: a **new** `<p className="lp-body">` right after the paragraph at lines 64 to 67 that ends "...you follow up from your own inbox, with Reply-To set to them." and before the paragraph at line 68 ("We recommend creating an exchange on your own card first..."). Line numbers checked against `main` at `dfeee96`. Existing text is unchanged.

FINAL (character for character):

`In this default mode, we email the follow-up letter to you, not to them. When you hit Reply, they get it from your own inbox, with your name, role and photo, and your contact card, ready to save. The contact card uses your full Google name and includes your Google account email address, your phone number if you added one, and the links on your card.`

JSX for the developer: one `<p className="lp-body">` with the text above. No em dashes.

## Decisions

- Approval (Diadem, Oct 27, 2026, 4:13 PM ET, verbatim): "Approve Option A for DIDI-920".
- Option B's extra save-link sentence ("The link to save your card does not expire. It gives your current card while your card is published, including to anyone your reply is forwarded to.") was **not approved** and is not part of the copy.
- New paragraph, not a rewrite of line 65, so DIDI-916's approved lines (76 to 82) and the existing default-mode sentence stay untouched.
- "your contact card, ready to save" reuses the DIDI-916 approved wording.

## Changes

- 2026-10-27: Section spec created with the relay mode behaviour list and proposed text (Options A and B), awaiting Diadem approval ([DIDI-920](https://linear.app/didi-build/issue/DIDI-920)).
- 2026-10-27, 4:13 PM ET: Diadem: "Approve Option A for DIDI-920". Relay-mode privacy disclosure approved, Option A ([DIDI-920](https://linear.app/didi-build/issue/DIDI-920)).
