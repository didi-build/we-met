# Incident notes

**Purpose:** Capture what happened during an outage or severe bug so the next responder has context.

For **privacy breaches** (unauthorized access, loss, or disclosure of personal information), use [privacy-breach.md](./privacy-breach.md) instead of this file.

## Communication order (approved)

Diadem approved **private updates first**, then a **public status page before general launch** where applicable ([DIDI-861](https://linear.app/didi-build/issue/DIDI-861)). Parent work: [DIDI-776](https://linear.app/didi-build/issue/DIDI-776) (status page ticket **M9**).

1. **Internal:** Triage using this template and [alert routing](./alert-routing.md). Fix or mitigate before broad comms when safe.
2. **Private (card owners):** Email affected **account owners** from **`hello@we-met.link`** with factual impact and next steps. Do not include other owners' data or visitor PII.
3. **Public status page:** Once [M9](../monitoring-plan.md#5-proposed-build-tickets) delivers a hosted status page, post an update there for user-visible incidents (major outage or degraded core flows). Link the status URL from this incident's Linear ticket.
4. **Customer email (not in use yet):** Draft subject and body text lives below for a future approval pass. **Do not send** those templates until CTO and Diadem record verbatim approval in Linear.

Alert delivery to operators remains **hello@we-met.link** per [alert-routing.md](./alert-routing.md).

## Template (copy per incident)

- **Date / duration:**
- **Impact:**
- **Timeline:**
- **Root cause:**
- **Fix:**
- **Follow-ups:** (tickets, runbook updates, decisions)
- **Comms sent:** (owner email, status page, customer email; links)

Keep entries factual. Link Linear issues and PRs.

## DRAFT, not approved for use: needs Diadem's verbatim approval before sending

The templates below are **drafts only**. They are not approved for production use. Do not send until Diadem (with CTO as needed) approves exact wording in Linear.

When approved, send from **`hello@we-met.link`**. Plain text is fine. Escape or remove bracket placeholders before sending.

### Outage (service unavailable)

**Subject:** We Met service interruption

We Met is experiencing an outage. Card pages or contact exchange may be unavailable.

We are investigating and will update you when service is restored. For urgent questions, reply to this email.

Thank you for your patience.

We Met

### Degraded (partial impact)

**Subject:** We Met degraded performance

We Met is online but some features are degraded. [Describe impact, for example delayed owner emails or intermittent card loads.]

We are working on a fix and will notify you when behavior is back to normal.

We Met

### Resolved

**Subject:** We Met incident resolved

The issue affecting We Met [brief description] is resolved as of [time and timezone].

[Optional one sentence on cause or prevention without blaming individuals.]

If you still see problems, reply to this email.

We Met

## Operator checklist during P1

- Confirm alert per [alert-routing.md](./alert-routing.md) (P1 may email at any hour).
- Use [rollback](./rollback.md) or mitigation runbooks as needed.
- Fill the incident template above.
- Owner email from **`hello@we-met.link`** when impact is known.
- Status page update when **M9** is live and the incident is user-visible.
- Postmortem follow-ups in Linear under [DIDI-776](https://linear.app/didi-build/issue/DIDI-776) or a child ticket.
