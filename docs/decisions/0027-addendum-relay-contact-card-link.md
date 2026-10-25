# 0027 addendum: Relay contact card link in the visitor letter (DIDI-832)

- **Status:** accepted
- **Date:** 2026-10-25
- **Parent:** [0027](./0027-owner-relay-visitor-follow-up.md)

## Context

In `owner_relay`, the visitor letter goes to the card owner with Reply-To set to the visitor. When the owner hits Reply, Gmail and Outlook often drop the `.vcf` attachment, so the visitor may not receive the owner's card.

## Decision

1. In **`owner_relay` only**, the visitor letter HTML and text include a plain **Save my contact card** link in the letter body (same quoted block as the attachment copy).
2. The link targets **`GET /api/exchange/<leadId>/contact-card?token=...`**, which returns the owner's **current** published card as `text/vcard`.
3. Access uses a dedicated signed token bound to the exchange id (`leadId`), separate from the 2-hour details token in `src/exchange/token.ts`. Signing key is **HKDF-derived** from existing **`WE_MET_TOKEN_SECRET`** (`src/exchange/exchange-contact-card-token.ts`); no new Worker secret.
4. Token lifetime: **no time expiry**. Downloads return **404** (no body leak) when the token is invalid, the route `leadId` does not match, or the card is unpublished or deleted.
5. Each successful download logs **`exchange_contact_card_download`** with **`leadId` only**.
6. The `.vcf` attachment on the visitor letter is unchanged. **`direct`** mode is unchanged (no link, no relay token on queue messages).

## Consequences

- Relay letters enqueued from the app Worker may carry optional `relayContactCardToken` on `visitor_letter_due` / `visitor_followup` queue payloads.
- Public `/hi/<slug>/contact.vcf` remains closed ([DIDI-641](https://linear.app/didi-build/issue/DIDI-641)); vCard over HTTP is only via token-gated exchange routes.
