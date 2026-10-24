# Test leads (Linear sink)

**Purpose:** When a card has an **enabled Linear** row in **`lead_sinks`** (step 2+), non-prod runs should create issues in a **test** Linear project with safe mail. **Step 1** has **no sink implementations** — nothing is delivered to Linear regardless of rows in `lead_sinks` ([0018](../decisions/0018-lead-sink.md)). The recognition and cleanup rules below apply **once the Linear sink kind is implemented** and configured on a test card.

## How to recognize a test lead

Every non-prod exchange that delivers to Linear for a test-configured card should create an issue with **all** of:

| Signal           | What to look for                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| **Label**        | `we-met-test-lead` (or label ID from sink `config`)                                            |
| **Title prefix** | `[we-met-test]` at the start of the title                                                      |
| **Environment**  | `WE_MET_ENV` value (`local` or `preview`) recorded in the issue description (not `production`) |

If any signal is missing on an issue you believe came from non-prod, treat it as suspicious and check card sink config and deploy bindings ([environments.md](../architecture/environments.md)).

## Cleanup

1. In Linear, filter by the test lead label in the project configured on the card’s Linear sink row.
2. Confirm the description includes a non-prod `WE_MET_ENV`.
3. Archive or delete test issues after the test session. Do not merge test leads into production reporting.

## Deliberate end-to-end email test (exchange + follow-up consumer)

Use this after changing the mail or consumer path. Default non-prod **`visitor_email_mode`** is **`owner_relay`**. See [kill-switch-and-caps](./kill-switch-and-caps.md) to flip modes.

Each exchange sends **two** emails: the visitor letter (`Great meeting you, {first name}`) and the owner relay email (`You met {visitor name}`). Daily caps count **two** slots per exchange in both modes ([0027](../decisions/0027-owner-relay-visitor-follow-up.md)).

### Shared steps

1. Open a **PR preview** (non-prod bindings only). Local dev with remote queue is acceptable for narrower checks.
2. Submit the exchange form with obvious fake contact details (`@example.com` only in automated tests; use a disposable address you control for manual runs).
   - **Local:** Turnstile uses Cloudflare’s always-pass **test key pair** (widget auto-passes).
   - **Preview:** complete the **real** Turnstile challenge (widget **we-met nonprod**).
3. Confirm `POST /api/exchange` returns **200** and a non-empty signed details token.
4. Confirm jobs on **`we-met-followup-email-nonprod`** (visitor letter and owner email messages).
5. Mail should arrive **From** `hello@mail.we-met.link` (secret **`WE_MET_EMAIL_FROM_CLOUDFLARE`**). Non-prod delivery is redirected to **`WE_MET_TEST_MAIL_TO`**; subjects prefix the real sink destination as `[we-met test → owner@example.com]` when the letter goes to the owner.
6. No Linear verification until the Linear sink kind ships.

### Owner relay mode (default)

**When:** `visitor_email_mode` is missing or `owner_relay` (see [0027](../decisions/0027-owner-relay-visitor-follow-up.md)).

1. After exchange, optional details: submit, skip/close (dismiss), or leave the sheet and wait for the **10-minute** fallback.
2. In **`WE_MET_TEST_MAIL_TO`**, expect **two** emails per exchange:
   - **Visitor letter** (to the owner; Reply-To visitor; **`.vcf`** attached). Subject: `Great meeting you, {visitor first name}` (with the non-prod prefix when redirected). Body is the visitor letter template (no visitor email, job title, company, or note rows).
   - **Owner relay** (to the owner). Subject: `You met {visitor full name}` (with the non-prod prefix above). **Reply-To:** the visitor address (also redirected to the test inbox in non-prod). Body: owner relay template (`Hit Reply to write back`); optional phone, job title, company, and note rows only when provided (no dash placeholders).
3. **No** `Re:` details email, **no** `In-Reply-To` / `References` threading headers on either message.
4. Token-gated vCard: on the receipt, use **Save contact** (`POST /api/exchange/vcard`) and confirm a `.vcf` with the owner’s account email and card fields.

### Direct visitor follow-up mode

**When:** `visitor_email_mode` is exact lowercase **`direct`**.

1. Same exchange and optional-details flow as above.
2. In **`WE_MET_TEST_MAIL_TO`** (owner mail redirected) and the visitor address (letter redirected in non-prod), expect **two** emails per exchange:
   - **Visitor letter** to the **visitor** (From `{owner first name} via We Met` when valid, else **`WE_MET_FROM_DISPLAY_NAME`**; Reply-To owner; **`.vcf`** attached).
   - **Owner relay** to the owner: same `You met` template and detail rows as owner relay mode (not the legacy `New lead added` template).
3. Owner mail uses **`WE_MET_FROM_DISPLAY_NAME`** (example: `Diadem at We Met`).

### Flip `visitor_email_mode` per environment (operators only)

**UNVERIFIED:** The SQL below is documented for operators only. **Do not** run it from CI, from this runbook as an automated step, or without owner sign-off. Wrong environment or binding can change the wrong database.

Use the canonical SQL and mode semantics in [kill-switch-and-caps](./kill-switch-and-caps.md#visitor-email-mode-owner-relay-vs-direct) (`INSERT` / read-back for `visitor_email_mode`). Run it only through the D1 steps in [d1-operator-sql.md](./d1-operator-sql.md):

- **Non-prod remote:** binding name is always **`WE_MET_DB`** against database **`we-met-db-nonprod`**, using a config from `scripts/prepare-wrangler-config.mjs` (`--target d1-migrate-nonprod`, output `wrangler.d1-nonprod.ci.jsonc`). Do **not** use `npx wrangler d1 execute we-met-db-nonprod`; that name does not match `wrangler.jsonc` (production binds `we-met-db`; non-prod uses the prepared preview config).
- **Production:** follow the **Production** section of [d1-operator-sql.md](./d1-operator-sql.md): reviewed one-off SQL, `prepare-wrangler-config.mjs --target production`, and a **second person** for destructive or high-impact statements. The GitHub **`production`** environment approval gates **deploys**, not ad-hoc laptop SQL.

Keep **`owner_relay`** in production until the [DIDI-656](https://linear.app/didi-build/issue/DIDI-656) inbox-placement gate passes (see [When to switch back to owner relay](#when-to-switch-back-to-owner-relay) below). Do not set `direct` in production for deliverability experiments without an explicit owner decision.

### When to switch back to owner relay

Keep **`owner_relay`** in production until deliverability gates pass ([DIDI-656](https://linear.app/didi-build/issue/DIDI-656), [DIDI-661](https://linear.app/didi-build/issue/DIDI-661)):

- **Decision gate ([DIDI-656](https://linear.app/didi-build/issue/DIDI-656)):** at least **80% Inbox** on fresh Gmail seed mailboxes for both visitor and owner mail before pointing real traffic at the new card (for example `didi.build/hi` redirect). Below that, stay on owner relay or execute the documented fallback (hybrid provider, alternate ESP, or Gmail-only).
- **Warm-up ([DIDI-661](https://linear.app/didi-build/issue/DIDI-661)):** prefer steady real exchanges with replies; weekly placement logs on control mailboxes.

After a non-prod manual run, record folder placement (Inbox, Spam, Promotions) and comment on [DIDI-739](https://linear.app/didi-build/issue/DIDI-739).

## Deliberate end-to-end test (with Linear sink, step 2+)

After the **Linear** sink kind ships, configure a test card with an enabled `lead_sinks` row (non-secret `config` + `connectionId` for OAuth). Repeat the email steps above, then:

1. Confirm a new Linear issue with the test label, title prefix `[we-met-test]`, and `WE_MET_ENV` in the description.
2. Run [cleanup](#cleanup) when done.

Routine testing does not send mail to production inboxes; use preview (or local with redirect) and `WE_MET_TEST_MAIL_TO` only. One real production check is part of [DIDI-578](https://linear.app/didi-build/issue/DIDI-578).
