# Legal: privacy page

Design-only spec for the copy on the We Met privacy page (`/privacy`, rendered by `src/components/landing/PrivacyPolicyContent.tsx`). Copy only: layout, headings and styling are unchanged.

## Purpose

The privacy page tells card owners what the people they meet can see. Two lines say the owner's contact card is "attached". The visitor letter can carry the card in different ways, so the page should describe it in words that stay true in every case.

## How the contact card travels (states)

Checked against `main` at `f19c6b6` (`src/followup-email-consumer/process-batch.ts`, `src/email/templates/visitor-followup.*`, [0027 addendum](../../../docs/decisions/0027-addendum-relay-contact-card-link.md)).

| Mode | Who gets the letter from We Met | Card in the letter | What the visitor ends up with |
| --- | --- | --- | --- |
| Direct | The visitor ("{first} via We Met") | .vcf attached; letter says "My contact card is attached, open it to save me to your phone." | The attachment |
| Relay, with save link (default) | The owner, who hits Reply to send it on | .vcf attached **and** a "Save my contact card" link in the body | The save link, plus the attachment if their mail app keeps it on Reply |
| Relay, fallback (no save link token) | The owner, who hits Reply to send it on | .vcf attached; letter uses the "attached" line | The attachment, if their mail app keeps it on Reply |

Landing wording for the same idea (from [landing/relay-mode/spec.md](../../landing/relay-mode/spec.md)): "When you hit Reply, they can save your contact card." and "They can save your card". The landing keeps "attached" out of its copy.

## Final copy

**Proposed, awaiting Diadem approval.** Not approved yet. Any edit after approval needs a fresh approval ([DIDI-916](https://linear.app/didi-build/issue/DIDI-916)).

Section "What the people you meet can see". BEFORE is the rendered sentence, verbatim from the JSX (line breaks in the source are spaces on the page).

### 1. Follow-up email contents

- File: `src/components/landing/PrivacyPolicyContent.tsx`, lines 76 to 78 (sentence starts on line 76)
- BEFORE: `That email also includes your display name on the card (or your Google name if you left display name blank), your role and photo, and your contact card attached.`
- AFTER: `That email also includes your display name on the card (or your Google name if you left display name blank), your role and photo, and your contact card, as an attachment, a link to save it, or both.`
- Alternative (shorter, less specific): `That email also includes your display name on the card (or your Google name if you left display name blank), your role and photo, and your contact card, ready to save.`

### 2. Phone number in the card

- File: `src/components/landing/PrivacyPolicyContent.tsx`, lines 81 to 82
- BEFORE: `When we send that optional follow-up email, if you added a phone number it is included in the contact card attached.`
- AFTER: `When we send that optional follow-up email, if you added a phone number it is included in the contact card.`

### Reviewed, no change

- Line 60, section "Who can see the emails": `...recipients, sender and reply-to addresses, subject, bodies, and attachments.` This is about what Cloudflare receives, and every visitor letter carries the .vcf, so it stays accurate.
- `src/components/landing/TermsPolicyContent.tsx`: no "attached" or contact card wording.

## Decisions

- Product direction (Diadem, Oct 27, 2026, 3:53 PM ET, verbatim, on [DIDI-916](https://linear.app/didi-build/issue/DIDI-916)): "Yes, propose new wording for DIDI-869 and I'll approve the exact text". **Matches Product direction: yes.** This spec proposes wording only and waits for approval of the exact text.
- "an attachment, a link to save it, or both" covers all three states: direct (attachment), relay with save link (link, and the attachment when the mail app keeps it), relay fallback (attachment).
- No behaviour change. No em dashes.

## Implementation notes

- Developer ticket: [DIDI-917](https://linear.app/didi-build/issue/DIDI-917). Apply only the approved text, character for character, and cover it in `test/landing/privacy-terms.test.tsx`.

## Changes

- 2026-10-27: Spec created with proposed wording for the two "attached" lines, awaiting Diadem approval ([DIDI-916](https://linear.app/didi-build/issue/DIDI-916), from [DIDI-869](https://linear.app/didi-build/issue/DIDI-869)).
