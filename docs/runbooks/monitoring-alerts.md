# Production monitoring alerts (M3, M4, M6)

**Purpose:** Click-by-click Cloudflare dashboard setup for three alerts from [monitoring-plan.md](../monitoring-plan.md) section 5 ([DIDI-776](https://linear.app/didi-build/issue/DIDI-776), build ticket [DIDI-938](https://linear.app/didi-build/issue/DIDI-938)). Diadem performs these steps after merge ([DIDI-943](https://linear.app/didi-build/issue/DIDI-943)).

**Audience:** Cloudflare account owner (non-expert friendly).

**Scope:** Production account only. Queue names and Workers match [environments.md](../architecture/environments.md).

**Routing ([DIDI-861](https://linear.app/didi-build/issue/DIDI-861)):**

| Setting                                           | Value                                                    |
| ------------------------------------------------- | -------------------------------------------------------- |
| Destination                                       | **hello@we-met.link**                                    |
| Channel                                           | **Email only** (no SMS, phone, or chat for these alerts) |
| Outages (P1, for example synthetic failure in M5) | Any hour                                                 |
| M3, M4, M6 (degraded / operational)               | **08:00 to 22:00 America/Toronto** only                  |

**Privacy ([monitoring-plan.md](../monitoring-plan.md) section 3.7):** Alert email must not include visitor email addresses, message bodies, or queue payloads. Monitors below use **numeric backlog counts** only. Do not paste queue message bodies or log lines into monitor names or descriptions.

---

## Before you start

1. **Sign in** to the [Cloudflare dashboard](https://dash.cloudflare.com/) and select the **We Met production account**.
2. **Confirm Issues are on** for production app and follow-up consumer ([DIDI-860](https://linear.app/didi-build/issue/DIDI-860)): each Worker should have `observability.issues.enabled` in Wrangler and a recent production deploy. Open **Observability** > **Issues** and confirm issues can appear for **`we-met`** and **`we-met-followup-email-consumer`** ([Issues docs](https://developers.cloudflare.com/workers/observability/issues/), checked **2026-10-28**).
3. **Collect queue IDs** (Monitors filter on `queueID`, not display name):
   - Go to **Workers & Pages** > **Queues**.
   - Open each queue below and copy its **Queue ID** from the queue details page (or from the URL):
     - **`we-met-followup-email`** (M3)
     - **`we-met-warmup-send-dlq`** (M4)
     - **`we-met-warmup-email-events-dlq`** (M4)
   - Warmup queue names are documented in [`workers/warmup/README.md`](../../workers/warmup/README.md).

### Shared email destination (all monitors)

Cloudflare **Monitors** deliver through **Observability** > **Alerts** ([Monitors](https://developers.cloudflare.com/notifications/monitors/), checked **2026-10-28**).

1. Go to **Observability** > **Alerts** > **Destinations**.
2. If **hello@we-met.link** is not listed under email destinations, add it and complete any verification Cloudflare requires ([Configure alerts](https://developers.cloudflare.com/notifications/get-started/), checked **2026-10-28**).

### Quiet hours (08:00 to 22:00 America/Toronto)

Cloudflare **Monitors** and **Issues automations** do **not** document recurring quiet-hour schedules ([Configure alerts](https://developers.cloudflare.com/notifications/get-started/), checked **2026-10-28**). **Silences** mute alerts for a **fixed** time range only ([Configure alerts](https://developers.cloudflare.com/notifications/get-started/), checked **2026-10-28**).

**UNVERIFIED:** The dashboard may offer a recurring silence or time-of-day filter not yet in public docs. During [DIDI-943](https://linear.app/didi-build/issue/DIDI-943), check **Observability** > **Alerts** > **Silences** for a recurring schedule on M3, M4, and M6.

**Fallback (if no recurring silence):**

1. Accept overnight email for M3/M4/M6 until a better option exists, **or**
2. Use an **email client rule** on **hello@we-met.link** to file messages whose subject contains `We Met M3`, `We Met M4`, or `We Met M6` outside 08:00 to 22:00 America/Toronto into a non-notifying folder (operator choice; not a Cloudflare feature).

Outage alerts from other tickets (for example M5 synthetic checks) stay **24 hours**; do not silence those.

---

## M3: Follow-up queue backlog high for 30 minutes

| Field                                 | Value                                                                                                                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plan row**                          | M3                                                                                                                                                                                                   |
| **Notification type**                 | **Monitor** (threshold), under **Observability** > **Alerts** > **Monitors**                                                                                                                         |
| **Dataset**                           | **`queuesBacklogAdaptiveGroups`** (metric **`messages`**, average backlog message count) ([Queues metrics](https://developers.cloudflare.com/queues/observability/metrics/), checked **2026-10-28**) |
| **SQL API dataset name (custom SQL)** | **`queues.queuesBacklogAdaptiveGroups`** ([Monitors](https://developers.cloudflare.com/notifications/monitors/), checked **2026-10-28**)                                                             |
| **Queue (production)**                | **`we-met-followup-email`**                                                                                                                                                                          |
| **Severity / hours**                  | P2 degraded; email **08:00 to 22:00 America/Toronto** (see quiet hours above)                                                                                                                        |

**UNVERIFIED:** Whether **`queuesBacklogAdaptiveGroups`** appears in the Monitors dataset picker for this account ([Monitors](https://developers.cloudflare.com/notifications/monitors/), checked **2026-10-28**). If the dataset is missing, use the **Fallback** at the end of this section.

### Dashboard steps

1. Go to **Observability** > **Alerts** > **Monitors**.
2. Select **Create a Monitor**.
3. **Detection method:** **Threshold**.
4. **Query** (choose one path):

   **Path A (visual builder, preferred):**

   - **Dataset scope:** Account (not zone).
   - **Dataset:** **`queuesBacklogAdaptiveGroups`** (or the closest label, for example "Queues backlog").
   - **Metric:** **`messages`** with aggregate **AVG** (adaptively sampled datasets use weighted **AVG** per [Monitors](https://developers.cloudflare.com/notifications/monitors/), checked **2026-10-28**).
   - **Filter:** **`queueID`** equals the ID you copied for **`we-met-followup-email`**.

   **Path B (custom SQL)** if the builder is unavailable but SQL validates:

   ```sql
   SELECT AVG(messages) AS value
   FROM queues.queuesBacklogAdaptiveGroups
   WHERE accountTag = '<YOUR_ACCOUNT_TAG>'
     AND queueID = '<WE_MET_FOLLOWUP_EMAIL_QUEUE_ID>'
   ```

   Replace placeholders. Omit a trailing semicolon ([Monitors](https://developers.cloudflare.com/notifications/monitors/), checked **2026-10-28**). Use **Automatic** time range (omit timestamp filter in SQL).

5. **Threshold settings:**
   - **Evaluation window:** **30 minutes** (custom duration).
   - **Comparison operator:** **`>`** (greater than).
   - **Threshold:** **`10`** messages (starting point; raise if normal traffic legitimately holds a higher backlog, lower if you want earlier warning).
6. **Execution interval:** **Default** (typically **1 minute** for this dataset; [Monitors](https://developers.cloudflare.com/notifications/monitors/), checked **2026-10-28**).
7. **Repeat notification interval:** **`1h`** (or longer to reduce repeat mail while the monitor stays active).
8. **Name:** `We Met M3 follow-up queue backlog`.
9. **Description:** Optional; use counts only (no payloads). Example: `Production we-met-followup-email backlog high 30m`.
10. **Destination:** Email **hello@we-met.link** (from shared destination above).
11. Run **query preview** over the last 7 days if offered; confirm the chart looks plausible ([Monitors](https://developers.cloudflare.com/notifications/monitors/), checked **2026-10-28**).
12. Select **Create**.
13. Open the monitor **action menu** (**...**) > **Test** and confirm mail arrives at **hello@we-met.link** with **no** visitor email or message body ([Configure alerts](https://developers.cloudflare.com/notifications/get-started/), checked **2026-10-28**).

### Fallback if the dataset is unavailable

1. **Manual (daily):** **Workers & Pages** > **Queues** > **`we-met-followup-email`** > **Metrics** and watch **Backlog messages** ([Queues metrics](https://developers.cloudflare.com/queues/observability/metrics/), checked **2026-10-28**).
2. **Optional later ticket:** Poll the [Queues metrics REST API](https://developers.cloudflare.com/api/resources/queues/methods/get_metrics/) from an approved Worker and send mail via Email Service (requires code and privacy review; not part of DIDI-938).

---

## M4: Warmup dead-letter queue non-zero for 15 minutes

| Field                   | Value                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plan row**            | M4                                                                                                                                                                   |
| **Notification type**   | **Monitor** (threshold), same as M3                                                                                                                                  |
| **Dataset**             | **`queuesBacklogAdaptiveGroups`**, metric **`messages`** ([Queues metrics](https://developers.cloudflare.com/queues/observability/metrics/), checked **2026-10-28**) |
| **Queues (production)** | **`we-met-warmup-send-dlq`** **or** **`we-met-warmup-email-events-dlq`** (alert if **either** is non-zero)                                                           |
| **Severity / hours**    | P3 reputation / warmup path; email **08:00 to 22:00 America/Toronto**                                                                                                |

**UNVERIFIED:** Same dataset picker availability as M3.

Create **two** monitors (simplest for operators). Each fires when **that** DLQ holds messages for **15 minutes**.

### Monitor M4a (`we-met-warmup-send-dlq`)

Repeat [M3 dashboard steps](#dashboard-steps) with these differences:

- **Filter / SQL `queueID`:** ID for **`we-met-warmup-send-dlq`**.
- **Evaluation window:** **15 minutes**.
- **Comparison operator:** **`>`**.
- **Threshold:** **`0`** (fires when average backlog messages over 15 minutes is above zero).
- **Name:** `We Met M4 warmup send DLQ`.
- **Description:** Example: `we-met-warmup-send-dlq backlog above 0 for 15m`.

### Monitor M4b (`we-met-warmup-email-events-dlq`)

Same as M4a, but:

- **Queue ID:** **`we-met-warmup-email-events-dlq`**.
- **Name:** `We Met M4 warmup email-events DLQ`.

**Destination:** **hello@we-met.link** for both. **Test** each monitor after creation.

### Fallback if the dataset is unavailable

Same as M3 fallback, but open each DLQ under **Workers & Pages** > **Queues** and inspect backlog metrics manually during Toronto daytime hours.

---

## M6: Workers Issues automation (title and dashboard link only)

| Field                 | Value                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Plan row**          | M6                                                                                                                          |
| **Notification type** | **Workers Issues automation** (not a Platform Notification preset)                                                          |
| **Product docs**      | [Set up an automation](https://developers.cloudflare.com/workers/observability/issues/automations/), checked **2026-10-28** |
| **Workers in scope**  | Production **`we-met`**, **`we-met-followup-email-consumer`** (Issues enabled in Wrangler)                                  |
| **Severity / hours**  | Operational / degraded; email **08:00 to 22:00 America/Toronto** (quiet hours above)                                        |

Documented **Issues automation destination types** are **coding agent**, **generic webhook**, **chat**, and **incident management** ([automations](https://developers.cloudflare.com/workers/observability/issues/automations/), checked **2026-10-28**). Those destinations can include **error text, stack traces, logs, and request metadata** ([automations](https://developers.cloudflare.com/workers/observability/issues/automations/), checked **2026-10-28**), which violates [monitoring-plan.md](../monitoring-plan.md) section 3.7 if forwarded verbatim to email.

**UNVERIFIED:** The dashboard may offer an **Email** destination (or a minimal template) under **Issues** > **Automations** that is not listed in public docs yet. **Verify during DIDI-943 before enabling automation.**

### Intended configuration (after dashboard verification)

1. Go to **Observability** > **Issues** ([Issues overview](https://developers.cloudflare.com/workers/observability/issues/), checked **2026-10-28**)).
2. Select **Automations** > **Add automation**.
3. **Trigger:** **Occurrence threshold** **`1`** (first grouped failure on a new issue) **or** **`3`** if single errors are too noisy ([automations](https://developers.cloudflare.com/workers/observability/issues/automations/), checked **2026-10-28**). Optional second automation: **Recurrence after inactivity** (for example **24 hours**) for issues that return after quiet period.
4. **Scope:** Limit to production Workers **`we-met`** and **`we-met-followup-email-consumer`** if the UI offers Worker filters.
5. **Destination:**
   - If **Email** is available: create or select an email destination for **hello@we-met.link**. Configure the template so the message contains **only** the **issue title** (or summary line) and a **link to the issue** in the Issues dashboard (copy the issue URL from the browser when testing). Do **not** enable attachments or diagnostic bundles in email.
   - If only **Generic webhook**, **Chat**, or **coding agent** appear: **stop**; do not connect them to **hello@we-met.link** without a privacy-filtering relay (future code ticket).
6. **Enabled:** On.
7. Select **Create**.
8. **Test without waiting for production traffic:** Open any **Active** issue (or use **Send to destination** on an issue row if shown), run the automation manually, and read the email ([Run and review an automation](https://developers.cloudflare.com/workers/observability/issues/automations/), checked **2026-10-28**)). **Reject** the setup if the message includes stack traces, raw log lines, visitor fields, or queue payload text.

**Issues dashboard link (manual bookmark):** **Observability** > **Issues** in the Cloudflare dashboard. Paste that base URL in the runbook incident notes when an alert fires; per-issue URLs look like the issue detail page URL in your browser (account-specific; do not commit account IDs to git).

### Fallback if email cannot be limited to title and link

1. **Do not** enable Issues automations to **hello@we-met.link** via webhook or chat.
2. **Operational:** During **08:00 to 22:00 America/Toronto**, open **Observability** > **Issues** daily (or after deploys) and triage **Active** issues for **`we-met`** and **`we-met-followup-email-consumer`** ([Investigate issues](https://developers.cloudflare.com/workers/observability/issues/investigate/), checked **2026-10-28**)).
3. **Track a follow-up build ticket** for a small relay Worker that accepts a webhook and sends redacted mail (requires CTO + Diadem privacy review if it uses a third-party endpoint).

---

## After setup checklist ([DIDI-943](https://linear.app/didi-build/issue/DIDI-943))

- [ ] M3 monitor created, tested, and dataset availability recorded (verified or fallback noted).
- [ ] M4a and M4b monitors created and tested.
- [ ] M6 automation verified or fallback documented on the ticket.
- [ ] Quiet-hours approach chosen (silence, email rule, or interim overnight mail).
- [ ] Linear [DIDI-943](https://linear.app/didi-build/issue/DIDI-943) updated with dates and any **UNVERIFIED** items resolved or accepted.

---

## References

- [Monitoring plan](../monitoring-plan.md) section 3.4 (routing), 3.7 (privacy), section 5 (M3, M4, M6)
- [DIDI-861](https://linear.app/didi-build/issue/DIDI-861) (routing answers)
- [Cloudflare Monitors](https://developers.cloudflare.com/notifications/monitors/) (checked **2026-10-28**)
- [Queues metrics / `queuesBacklogAdaptiveGroups`](https://developers.cloudflare.com/queues/observability/metrics/) (checked **2026-10-28**)
- [Workers Issues automations](https://developers.cloudflare.com/workers/observability/issues/automations/) (checked **2026-10-28**)
- [Configure alerts / silences](https://developers.cloudflare.com/notifications/get-started/) (checked **2026-10-28**)
