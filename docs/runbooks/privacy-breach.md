# Privacy breach (PIPEDA)

**Purpose:** Respond to a **breach of security safeguards** involving personal information under [PIPEDA](https://www.priv.gc.ca/en/privacy-topics/privacy-breaches/). This runbook is for **privacy and security incidents** (unauthorized access, loss, or disclosure of personal information).

**Not for:** Service outages, bugs without personal-information exposure, or routine security hygiene. Use [incident.md](./incident.md) for outage notes only.

**Data inventory:** [`docs/privacy/data-map.yml`](../privacy/data-map.yml) and [`audit-findings.md`](../privacy/audit-findings.md).

**Contact:** `hello@we-met.link` (also the privacy contact on the public privacy page).

## When to use this runbook

Start this process when you have **reasonable belief** that personal information under We Met’s control was accessed, lost, or disclosed **without authorization**, or when safeguards failed in a way that could lead to that outcome.

Examples that may trigger this runbook (not exhaustive):

- Leaked **Cloudflare** or **Google** API token, OAuth client secret, or Wrangler/deploy credential with access to production D1, R2, queues, or operator Gmail.
- Unauthorized access to the **Cloudflare dashboard**, **Google Workspace** mailbox used for outbound mail, or operator laptops with active sessions.
- Suspected exfiltration of **queue messages** (visitor name, email, phone) or **Worker logs/traces** that captured request payloads.
- Misdirected lead or follow-up **email** containing visitor or card-owner personal information.

If the event is **only** availability impact with no personal-information angle, document it in [incident.md](./incident.md) instead.

## Roles

| Role               | Responsibility                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Incident lead**  | Owns timeline, decisions, and communications until closed.                                                                                |
| **Privacy lead**   | RROSH assessment, OPC reporting, affected-individual notification, breach record. Often the same person as incident lead in a small team. |
| **Technical lead** | Containment, evidence preservation, scope (which systems and data classes).                                                               |

Record who holds each role in the breach record (template below).

## Response phases

### 1. Contain (as soon as possible)

- Revoke or rotate compromised credentials (Cloudflare API tokens, Google service account or OAuth secrets, `WE_MET_TOKEN_SECRET`, deploy keys). Follow [deploy-setup.md](./deploy-setup.md) and [kill-switch-and-caps.md](./kill-switch-and-caps.md) where relevant.
- Suspend affected accounts if an operator account is involved ([suspend-and-unsuspend.md](./suspend-and-unsuspend.md)).
- Block further harm (disable a sink, pause consumer, close sign-ups via `app_settings` if abuse is ongoing).
- Preserve evidence: export relevant Cloudflare audit logs, GitHub audit log, and log streams **before** retention windows expire. Map: `logs.worker_app`, `logs.worker_consumer` (retention vendor-dependent; see data map).

Do **not** destroy logs needed to establish scope.

### 2. Scope (what personal information, how many people)

Use the data map to list **whose** data may be involved (`whose: card_owner`, `visitor`, etc.) and **where** it lives:

| Store                                 | Personal information at risk (from map)                         | Notes                                                                                                                                |
| ------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| D1 `accounts`, `cards`, `card_drafts` | Card-owner profile, card content, optional phone                | Tombstoning does not remove ledger rows.                                                                                             |
| D1 `lead_delivery_ledger`             | No visitor lead **content**; metadata and `external_ref` only   | ADR 0022.                                                                                                                            |
| Queues `queue.*`                      | Visitor name, email, phone in message bodies                    | Retention **86,400 s (24 h)** per dashboard read **2026-10-17**; not pinned in repo.                                                 |
| R2 `storage.r2.card_photo`            | Card photos                                                     | Content-addressed keys.                                                                                                              |
| Email in transit / mailboxes          | Lead and follow-up bodies                                       | Provider-dependent; map entries `email.*` are `verified: false` for retention.                                                       |
| Browser                               | Session cookie, OAuth state, details token                      | Short TTL; usually not the primary breach vector.                                                                                    |
| Worker observability                  | May include URLs, IPs, or payloads depending on what was logged | Retention **unknown** for traces; Workers Logs **7 days** on Workers Paid per vendor docs (`verified: false` for plan confirmation). |

Estimate **number of affected individuals** with ranges if exact counts are not yet known. Mark unknowns as unknown.

### 3. Real risk of significant harm (RROSH) assessment

PIPEDA requires reporting to the **Office of the Privacy Commissioner of Canada (OPC)** and notifying affected individuals when a breach creates a **real risk of significant harm** to the individual (RROSH). Harm includes bodily harm, humiliation, damage to reputation or relationships, loss of employment or professional opportunities, financial loss, identity theft, negative effects on credit, and damage to or loss of property.

**Assessment record** (complete for every breach, even if RROSH is “no”):

1. **Sensitivity** of the personal information involved (e.g. visitor contact details, card-owner Google email shared with exchangers, photos).
2. **Probability** the information has been or will be misused (who had access, whether data was encrypted, whether credentials were public).
3. **Circumstances** of the breach (intentional, accidental, duration of exposure).
4. **Mitigation** already applied (rotation, deletion, no evidence of access).

**Decision:**

- [ ] **RROSH: Yes** → proceed to §4 (OPC) and §5 (notification) **as soon as feasible**.
- [ ] **RROSH: No** → no OPC report or individual notification required under PIPEDA for this breach; still complete §6 (24-month record) and post-incident review.

If uncertain, treat as RROSH **yes** until privacy lead confirms otherwise.

### 4. Report to the OPC (when RROSH is yes)

- Submit using the OPC’s **breach report form** for organizations: [Report a privacy breach](https://www.priv.gc.ca/en/privacy-topics/privacy-breaches/report-a-privacy-breach-at-your-business/).
- Report **as soon as feasible** after determining RROSH.
- Include: organization contact, description of circumstances, date or period, personal information involved, number of affected individuals (or estimate), steps taken to reduce risk, and contact for public inquiries.

Keep a copy of the submission and confirmation in the breach record.

### 5. Notify affected individuals (when RROSH is yes)

- Notify **as soon as feasible** after determining RROSH (may be parallel with OPC reporting).
- Notification must allow the person to understand the **significance** of the breach and take steps to reduce harm. Include:
  - What happened (plain language).
  - What personal information was involved.
  - What you have done to reduce risk.
  - What the person can do (e.g. monitor accounts, beware of phishing).
  - Contact for questions (`hello@we-met.link`).

**Channels:** Email is appropriate when you have email addresses; use another reasonable channel if not. For card owners, use `accounts.email` **only if** still accurate and the breach did not compromise that channel.

Coordinate wording with privacy lead; do not include unrelated personal information in notifications.

### 6. Breach record (24 months)

PIPEDA requires organizations to keep a **record of every breach of security safeguards** involving personal information, whether or not RROSH was found, for **24 months** from the day you determined the breach occurred.

Store records in the team’s **restricted** compliance location (not in this git repo). Use the template below.

### 7. Post-incident

- Open Linear tickets for root cause and **code/config gaps** (see PR gap list in DIDI-687 / audit findings).
- Update this runbook or the data map if facts changed.
- For account-level remediation, see [account-deletion.md](./account-deletion.md) only when appropriate for the request (not a substitute for breach notification).

---

## Breach record template (copy per event)

Retain **24 months** from the date of determination.

```text
Breach record id:          BR-YYYY-MM-DD-###
Date determined:           YYYY-MM-DD (timezone)
Date discovered:           YYYY-MM-DD
Incident lead:             name
Privacy lead:              name
Technical lead:            name

Summary (what happened):
-

Personal information involved (data-map ids / categories):
-

Approximate number of individuals affected:
-

Containment actions (with timestamps):
-

RROSH assessment:
  Sensitivity:
  Probability of misuse:
  Circumstances:
  Mitigation:
  Decision (yes/no):       yes | no
  Assessor / date:

OPC report:
  Required:                yes | no
  Date submitted:
  Reference / confirmation:

Individual notification:
  Required:                yes | no
  Date(s) sent:
  Channel:
  Template version / link:

Evidence preserved (links, log exports):
-

Follow-up tickets (Linear):
-

Closed date:
```

---

## Tabletop walk-through: leaked service-account key

**Scenario:** A **Google Cloud service account JSON key** (or similar credential) used for Gmail API send was committed to a public fork, exposed in a screenshot, or shared in chat. The key had permission to send mail and read the operator mailbox used for We Met outbound email when `email_provider` is `gmail`.

**Goal:** Practice containment, scoping, RROSH, and record-keeping without touching production data stores in the exercise.

### Facilitator script

1. **Inject (0:00):** “A contributor reports that a service account key file appeared in a public GitHub gist titled ‘we-met debug’. The gist was live for about 45 minutes.”
2. **Contain (0:05):** Participants list immediate actions: revoke key in Google Cloud, rotate secrets, audit GitHub org access, search git history for other leaks. **Do not** run destructive SQL in the exercise.
3. **Scope (0:15):**
   - Could an attacker have **read** the operator Gmail mailbox (`email.operator_mailbox_visibility`)?
   - Could they have **sent** mail as We Met?
   - Is **D1** or **R2** in scope for this key? (Typically **no** for Gmail-only SA — state assumptions explicitly.)
   - Were **queue** messages accessible? (Typically **no** with Gmail key alone.)
4. **Data map (0:25):** List map entries at risk if mailbox was read: visitor leads and follow-ups in email (`email.owner_lead_record`, `email.owner_lead_append`, `email.visitor_followup`), not D1 lead content.
5. **RROSH (0:35):** Table debate: visitor emails and phone in mailbox copies; reputational/phishing risk. Decision yes/no and document rationale.
6. **OPC + notification (0:45):** Who submits OPC form? Draft bullet points for affected visitors if mailbox was read (unknown list → “as feasible” broad notification or log-based count).
7. **Record (0:55):** Fill a blank breach record template with fictional dates; assign follow-up ticket for secret scanning in CI.
8. **Debrief:** Gaps: CSP/headers unrelated; **credential storage**, **log retention**, and **email provider** cutover (DIDI-699) as separate tickets.

**Success criteria:** Team agrees on RROSH decision path, knows OPC and notification timing, and produces a completed breach record template in the exercise.

---

## Related

- [account-deletion.md](./account-deletion.md) — privacy erasure requests (not the same as breach response)
- [incident.md](./incident.md) — outage and severe bug notes
- [docs/privacy/data-map.yml](../privacy/data-map.yml) — inventory
- ADR [0025 §7](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md) — deletion and retained ledger
