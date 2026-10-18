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

## Deliberate end-to-end email test (step 1)

Use this after changing the mail or consumer path:

1. Open a **PR preview** (non-prod bindings only). Local dev with remote queue is acceptable for narrower checks.
2. Submit the exchange form with obvious fake contact details.
   - **Local:** Turnstile uses Cloudflare’s always-pass **test key pair** (widget auto-passes).
   - **Preview:** complete the **real** Turnstile challenge (widget **we-met nonprod**).
3. Confirm exchange returns **200** and a non-empty signed token; optional details step returns **200**.
4. Confirm jobs on **`we-met-followup-email-nonprod`**.
5. Check **`WE_MET_TEST_MAIL_TO`** for redirected **visitor** follow-up mail and **email** sink owner notifications (subject/body label the sink destination in non-prod). **Visitor** follow-up uses `{Google first name} via We Met` when the owner’s Google first name passes validation (example: `Diadem via We Met`); otherwise it falls back to secret **`WE_MET_FROM_DISPLAY_NAME`**. **Owner** sink mail always uses **`WE_MET_FROM_DISPLAY_NAME`** (example: `Diadem at We Met`).
6. **Cloudflare provider (optional):** after secrets include **`WE_MET_EMAIL_FROM_CLOUDFLARE`** and the consumer config binds **`EMAIL`**, flip non-prod only: `INSERT INTO app_settings (key, value) VALUES ('email_provider', 'cloudflare') ON CONFLICT(key) DO UPDATE SET value = excluded.value;` on **`we-met-db-nonprod`**. Repeat the exchange; mail should arrive **From** `hello@mail.we-met.link` with the same display-name rules. Owner **record** then **append** should thread in the mailbox using Cloudflare-generated `Message-ID` values (check ledger `external_ref` for `{ "provider": "cloudflare", "messageId": "..." }`). Roll back with `email_provider` = `gmail` before production cutover unless production is intentionally ready.
7. No Linear verification until the Linear sink kind ships.

## Deliberate end-to-end test (with Linear sink, step 2+)

After the **Linear** sink kind ships, configure a test card with an enabled `lead_sinks` row (non-secret `config` + `connectionId` for OAuth). Repeat the email steps above, then:

1. Confirm a new Linear issue with the test label, title prefix `[we-met-test]`, and `WE_MET_ENV` in the description.
2. Run [cleanup](#cleanup) when done.

Routine testing does not send mail to production inboxes; use preview (or local with redirect) and `WE_MET_TEST_MAIL_TO` only. One real production check is part of [DIDI-578](https://linear.app/didi-build/issue/DIDI-578).
