# Test leads in Linear

**Purpose:** Non-prod runs create real Linear issues with safe mail. Recognize them, clean up after tests, and run a deliberate end-to-end check.

## How to recognize a test lead

A non-prod exchange should create an issue with **all** of:

| Signal           | What to look for                                                                      |
| ---------------- | ------------------------------------------------------------------------------------- |
| **Label**        | `we-met-test` (or the env-specific test label configured for non-prod)                |
| **Title prefix** | `[we-met test]` at the start of the title                                             |
| **Environment**  | Field or comment metadata showing `preview`, `staging`, or `local` — not `production` |

If any signal is missing on a issue you believe came from non-prod, treat it as suspicious and check deploy bindings ([environments.md](../architecture/environments.md)).

## Cleanup

1. In Linear, filter by label `we-met-test` (and your team).
2. Confirm the environment metadata is non-prod.
3. Archive or delete test issues after the test session. Do not merge test leads into production reporting.

## Deliberate end-to-end email test

Use this after changing the mail or consumer path:

1. Deploy to **staging** or open a **PR preview** (non-prod bindings only).
2. Submit the card form with Turnstile test keys (use obvious fake contact details).
3. Confirm the browser gets success and a job lands on the **non-prod** queue.
4. Check **`WE_MET_TEST_MAIL_TO`** inbox for both sides of the exchange email (redirected from real addresses).
5. Confirm a new Linear issue with test label and title prefix.
6. Run [cleanup](#cleanup) when done.

Production E2E to real inboxes is out of scope for routine testing; use staging and the test address only.
