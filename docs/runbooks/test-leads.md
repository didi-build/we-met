# Test leads in Linear

**Purpose:** Non-prod runs create issues in the **one shared Linear test project** with safe mail. Recognize them, clean up after tests, and run a deliberate end-to-end check.

## How to recognize a test lead

Every non-prod exchange should create an issue with **all** of:

| Signal           | What to look for                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| **Label**        | `we-met-test-lead`                                                                             |
| **Title prefix** | `[we-met-test]` at the start of the title                                                      |
| **Environment**  | `WE_MET_ENV` value (`local` or `preview`) recorded in the issue description (not `production`) |

If any signal is missing on an issue you believe came from non-prod, treat it as suspicious and check deploy bindings ([environments.md](../architecture/environments.md)).

## Cleanup

1. In Linear, filter by label `we-met-test-lead` in the shared test project.
2. Confirm the description includes a non-prod `WE_MET_ENV`.
3. Archive or delete test issues after the test session. Do not merge test leads into production reporting.

## Deliberate end-to-end email test

Use this after changing the mail or consumer path:

1. Open a **PR preview** (non-prod bindings only). Local dev with remote queue is acceptable for narrower checks.
2. Submit the exchange form with obvious fake contact details. **Preview or local:** Turnstile uses Cloudflare’s always-pass **test key pair** (widget auto-passes).
3. Confirm exchange returns **200** and a non-empty signed token; optional details step returns **200**.
4. Confirm jobs on **`we-met-followup-email-nonprod`**.
5. Check **`WE_MET_TEST_MAIL_TO`** for redirected visitor and owner mail.
6. Confirm a new Linear issue in the **test project** with label `we-met-test-lead`, title prefix `[we-met-test]`, and `WE_MET_ENV` in the description.
7. Run [cleanup](#cleanup) when done.

Routine testing does not send mail to production inboxes; use preview (or local with redirect) and `WE_MET_TEST_MAIL_TO` only. One real production check is part of [DIDI-578](https://linear.app/didi-build/issue/DIDI-578).
