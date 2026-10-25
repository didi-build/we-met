# 0027 addendum: Relay contact card link in the visitor letter (DIDI-832)

- **Status:** accepted
- **Date:** 2026-10-25
- **Parent:** [0027](./0027-owner-relay-visitor-follow-up.md)

## Context

In `owner_relay`, the visitor letter goes to the card owner with Reply-To set to the visitor. When the owner hits Reply, Gmail and Outlook often drop the `.vcf` attachment, so the visitor may not receive the owner's card.

## Decision

1. In **`owner_relay` only**, the visitor letter HTML and text include a plain **Save my contact card** link in the letter body (same quoted block as the attachment copy).
2. The link targets **`GET /api/exchange/<leadId>/contact-card?token=...`**, which returns the owner's **current** published card as `text/vcard`. The handler loads the card by stable **`cardId`** from the token (not by `cardSlug`), so slug renames do not break links already sent.
3. Access uses a dedicated signed token bound to the exchange id (`leadId`) and **`cardId`**, separate from the 2-hour details token in `src/exchange/token.ts`. Signing key is **HKDF-derived** from existing **`WE_MET_TOKEN_SECRET`** (`src/exchange/exchange-contact-card-token.ts`); no new Worker secret.
4. Token lifetime: **no time expiry** (CTO accepted risk for [DIDI-832](https://linear.app/didi-build/issue/DIDI-832)). A forwarded or leaked relay letter grants permanent access to the owner's **current** published card until it is no longer visitor-visible. The token is in the **query string**, so it may appear in Cloudflare request logs, browser history, and mail security scanners. Revocation requires rotating **`WE_MET_TOKEN_SECRET`**, which also invalidates live exchange **details** tokens.
5. Each successful download logs **`exchange_contact_card_download`** with **`leadId` only**.
6. The `.vcf` attachment on the visitor letter is unchanged. **`direct`** mode is unchanged (no link, no relay token on queue messages).

## Cutover (CTO, 2026-10-25)

- **`visitor_letter_due` / `visitor_followup` messages queued before this deploy** may omit `relayContactCardToken`. Those letters still include the `.vcf` attachment but no body link. That is **accepted for cutover** (same style as the deploy-window notes in [0027](./0027-owner-relay-visitor-follow-up.md)).
- The follow-up **consumer does not mint** relay contact-card tokens when the field is missing.
- **`WE_MET_TOKEN_SECRET` stays off the consumer**; only the app Worker signs tokens at enqueue time.

**Mode drift at send time:** the app Worker decides whether to **mint** `relayContactCardToken` at exchange or finalize from D1 **`visitor_email_mode`**. The follow-up consumer decides whether to **render** the body link from **`visitor_email_mode` at send time** and the optional queue field. If production mode flips to **`owner_relay`** only after enqueue but before send, the letter goes out **without** the link (token absent). If mode flips to **`direct`** after a relay token was enqueued, the consumer **does not** render the link even though the payload may still carry `relayContactCardToken`.

## Copy follow-up

- **Attachment sentence after Reply** ([DIDI-836](https://linear.app/didi-build/issue/DIDI-836)): sent to Diadem for copy review. Ship the current sentence for now; the relay link mitigates dropped attachments.

## Consequences

- Relay letters enqueued from the app Worker may carry optional `relayContactCardToken` on `visitor_letter_due` / `visitor_followup` queue payloads.
- Public `/hi/<slug>/contact.vcf` remains closed ([DIDI-641](https://linear.app/didi-build/issue/DIDI-641)); vCard over HTTP is only via token-gated exchange routes.
