# Test leads (Linear sink)

**Purpose:** When cards use a **Linear** lead sink, non-prod runs should create issues in the **one shared Linear test project** with safe mail. **Step 1** uses a **no-op** sink (`kind: "none"`) — **no Linear issues** are created until the Linear sink implementation merges ([0018](../decisions/0018-lead-sink.md)). The rules below apply **once that sink exists**.

## How to recognize a test lead

Every non-prod exchange with a Linear-backed test card should create an issue with **all** of:

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

## Deliberate end-to-end email test (step 1)

Use this after changing the mail or consumer path while the lead sink is still **no-op**:

1. Open a **PR preview** (non-prod bindings only). Local dev with remote queue is acceptable for narrower checks.
2. Submit the exchange form with obvious fake contact details. **Preview or local:** Turnstile uses Cloudflare’s always-pass **test key pair** (widget auto-passes).
3. Confirm exchange returns **200** and a non-empty signed token; optional details step returns **200**.
4. Confirm jobs on **`we-met-followup-email-nonprod`**.
5. Check **`WE_MET_TEST_MAIL_TO`** for redirected visitor and owner mail.
6. Run [cleanup](#cleanup) when done (no Linear step in step 1).

## Deliberate end-to-end test (with Linear sink)

After the Linear sink is enabled on a **test** card in non-prod, repeat the email steps above and additionally:

1. Confirm a new Linear issue in the **test project** with label `we-met-test-lead`, title prefix `[we-met-test]`, and `WE_MET_ENV` in the description.
2. Run [cleanup](#cleanup) when done.

Routine testing does not send mail to production inboxes; use preview (or local with redirect) and `WE_MET_TEST_MAIL_TO` only. One real production check is part of [DIDI-578](https://linear.app/didi-build/issue/DIDI-578).
