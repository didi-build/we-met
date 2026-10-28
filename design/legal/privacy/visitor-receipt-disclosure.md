# Legal: privacy page, visitor receipt disclosure

Design-only section spec for the We Met privacy page (`/privacy`, `src/components/landing/PrivacyPolicyContent.tsx`). Copy only: the visitor receipt screen's behaviour does not change. Ticket: [DIDI-923](https://linear.app/didi-build/issue/DIDI-923). Dev: [DIDI-924](https://linear.app/didi-build/issue/DIDI-924). Related: [spec.md](spec.md) (DIDI-916), [relay-disclosure.md](relay-disclosure.md) (DIDI-920).

**Approved by Diadem, Oct 28, 2026, 12:11 AM ET (paragraph) and 12:12 AM ET (line 65) ([DIDI-923](https://linear.app/didi-build/issue/DIDI-923)). Any edit to this text needs a fresh approval.**

## Purpose

Right after an exchange, the visitor's screen shows the owner's Google account email address and phone number, with Email, Call and Save contact buttons. The section "What the people you meet can see" doesn't mention this.

## Product direction

> "Keep the visitor screen as is and have Designer draft privacy wording for it"

Diadem, Oct 27, 2026, 4:14 PM ET, verbatim (DIDI-923). **Matches Product direction: yes.** Copy only, no change to the screen.

## What the visitor sees and can do (checked against `main` at `dfeee96`)

| # | Item | Reference |
| --- | --- | --- |
| 1 | Before an exchange, the public card page withholds the owner's email and phone. | `src/lib/hi-card/hi-page-card.ts` 3 to 6, 26 to 33 |
| 2 | The receipt appears only after a successful exchange on a live card (card visitor-visible, Turnstile passed, rate limit and email capacity OK, letter enqueued). | `src/exchange/process-exchange.ts` 86 to 157; `src/card-data/lookup.ts` 28 to 56; `src/app/api/exchange/route.ts` 37 to 46 |
| 3 | Same in both modes: the exchange response always carries `ownerEmail` (the owner's Google account email) and `ownerPhone` only if the card has one. `visitor_email_mode` affects only the relay token. | `process-exchange.ts` 135 to 140, 185 to 192; `src/card-data/d1-repository.ts` 22 |
| 4 | Screen content: "Sent to {ownerFirst}", "Just now" (or "With your note"), a "Save {ownerFirst}'s contact" button, Email (mailto) and Call (tel, only with a phone) buttons, a line with the email and phone ("email · phone"), "{ownerFirst} will follow up by email.", and "Tell {ownerFirst} more about you". | `src/components/hi/HiVisitorReceipt.tsx` 70 to 75, 161 to 269; `src/app-card/default-card-copy.ts` 4 to 17; `src/lib/hi-card/visitor-receipt-copy.ts` 38 to 45 |
| 5 | Owner name and photo are already on the public card; the receipt adds no other owner fields. | `HiVisitorReceipt.tsx` 161 to 269 |
| 6 | Save contact posts the 2-hour exchange token to `POST /api/exchange/vcard` and downloads a .vcf of the owner's current live card. | `HiVisitorReceipt.tsx` 176 to 186; `src/app/api/exchange/vcard/route.ts` 88 to 104; `src/exchange/process-vcard.ts` 59 to 90 |
| 7 | The .vcf has the full name, nickname, company, title, Google account email, phone if added, photo if JPEG, card links and card note (same builder as the email attachment). | `process-vcard.ts` 83 to 89; `src/lib/hi/vcard.ts` 54 to 90 |
| 8 | How long: the exchange token lasts 2 hours. The receipt data (visitor first name and email, token, owner email and phone) is kept in the visitor's browser `sessionStorage` for that card, so the receipt survives a reload in the same tab until the token expires; then it falls back to the quiet "has your details" state. A `localStorage` flag ("1", no personal data) marks the exchange as done. | `src/exchange/token.ts` 4, 39; `src/lib/hi-card/exchange-session-storage.ts` 1 to 75; `src/components/hi/HiPageClient.tsx` 58 to 110, 176 to 194 |
| 9 | Stored or logged by We Met: nothing new for the receipt. The vCard route logs only photo errors (photo key). It is rate limited per IP. | `process-vcard.ts` 33 to 45, 54 to 57 |

UNKNOWN:
- Whether Cloudflare keeps response bodies (which contain `ownerEmail` and `ownerPhone`) in any log. Our code does not log them.
- `sessionStorage` lifetime is browser-defined (normally cleared when the tab closes); some browsers restore it with the tab.
- Whether a visitor saved the contact or copied the details (that stays with them after the 2 hours).

## Final copy

Section "What the people you meet can see" in `src/components/landing/PrivacyPolicyContent.tsx` (line numbers on `main` at `8cbb37b`; `src/` unchanged since `dfeee96`). Implemented by Developer in [DIDI-924](https://linear.app/didi-build/issue/DIDI-924). Two approved changes.

### 1. New paragraph (Option B)

Placement: a **new** `<p className="lp-body">` after the approved DIDI-920 relay paragraph ("In this default mode, we email the follow-up letter to you, not to them. ...") and before the paragraph at current line 68 ("We recommend creating an exchange on your own card first so you can see what visitors will get."). Final order: lines 64 to 67 paragraph, DIDI-920 paragraph, this paragraph, line 68 paragraph. If DIDI-924 lands before DIDI-921, put it directly after line 67; DIDI-921 then inserts its paragraph above this one.

FINAL (character for character):

`Whether or not visitor follow-up email is on, right after someone exchanges details with you, their screen shows your Google account email address and your phone number if you added one, with buttons to email or call you, and your contact card, ready to save. That screen stays available in their browser tab for up to two hours.`

### 2. Line 65 rewording

Line 65 to 66 was literally true, but next to this disclosure and DIDI-920 it read as if the visitor doesn't get your Google account email address by default. They do: on the receipt screen in every mode, and in the card when you hit Reply.

- File: `src/components/landing/PrivacyPolicyContent.tsx`, line 65 (paragraph text on lines 65 to 66)
- BEFORE: `By default, we don't email them your contact card or your Google account email address; you follow up from your own inbox, with Reply-To set to them.`
- FINAL: `By default, we don't email them anything; you follow up from your own inbox, with Reply-To set to them.`

In JSX the apostrophe stays `&apos;`. Accurate because in the default relay mode We Met emails the visitor nothing (ADR 0027, Decision 4; landing relay spec Q4).

DIDI-916 lines (76 to 82) and the DIDI-920 paragraph are untouched. No em dashes. "your contact card, ready to save" reuses the DIDI-916 approved wording.

## Decisions

- Approval, paragraph (Diadem, Oct 28, 2026, 12:11 AM ET, verbatim): "Approve Option B for DIDI-923". Option A alone (without the two-hour sentence) is not approved.
- Approval, line 65 (Diadem, Oct 28, 2026, 12:12 AM ET, verbatim): "Approve the new line 65 wording".
- New paragraph rather than edits to other approved text.
- "Whether or not visitor follow-up email is on" reuses the page's own term for direct mode (lines 73, 89) instead of "relay" or "direct".

## Changes

- 2026-10-27: Section spec created with the visitor receipt behaviour list, proposed text (Options A and B) and an optional line 65 fix, awaiting Diadem approval ([DIDI-923](https://linear.app/didi-build/issue/DIDI-923)).
- 2026-10-28, 12:11 AM ET: Diadem: "Approve Option B for DIDI-923". Visitor receipt paragraph approved, Option B ([DIDI-923](https://linear.app/didi-build/issue/DIDI-923)).
- 2026-10-28, 12:12 AM ET: Diadem: "Approve the new line 65 wording". Line 65 now reads "By default, we don't email them anything; you follow up from your own inbox, with Reply-To set to them." ([DIDI-923](https://linear.app/didi-build/issue/DIDI-923)).
