# Production alert routing

**Purpose:** Single source of truth for where production monitoring alerts go and when they may wake someone up. Approved by Diadem on [DIDI-861](https://linear.app/didi-build/issue/DIDI-861) (Oct 25, 2026). Parent plan: [DIDI-776](https://linear.app/didi-build/issue/DIDI-776), [monitoring-plan.md](../monitoring-plan.md).

**Scope:** Production Cloudflare Workers, queues, Email Sending, and external uptime checks described in the monitoring plan. Warmup reputation mail continues to use the existing `WARMUP_ALERT_TO` secret path ([warmup README](../../workers/warmup/README.md)); this runbook covers everything else.

## Destination

| Setting                          | Value                 |
| -------------------------------- | --------------------- |
| Operator inbox                   | **hello@we-met.link** |
| Channel                          | **Email only**        |
| SMS                              | **Not used**          |
| PagerDuty or other paging vendor | **Not used**          |

Configure Cloudflare Notifications, Monitors, Health Checks, **Upptime** notification settings in **`didi-build/we-met-status`** (CTO + Diadem per [monitoring-plan.md](../monitoring-plan.md) §3.7 and [DIDI-939](https://linear.app/didi-build/issue/DIDI-939)), Better Stack (§3.7 approval before adoption), and Workers Issues automations to send to **hello@we-met.link** unless a ticket explicitly documents a different routing (for example warmup).

## Severity and quiet hours

All times use **America/Toronto**.

| Severity                   | Meaning (see [monitoring-plan.md](../monitoring-plan.md) §3.2)                                                          | Email hello@we-met.link                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **P1 Outage**              | Confirmed user-visible outage (for example synthetic card check failure with elevated 5xx, or total loss of card pages) | **Any hour**, including overnight          |
| **P2 Degraded**            | Partial failure (mail backlog with delivery failures, account suspended, sustained Issues clusters)                     | **08:00 to 22:00** only                    |
| **P3 Warmup / reputation** | Warmup auto-pause, non-seed bounce summaries                                                                            | As today via `WARMUP_ALERT_TO`             |
| **P4 Informational**       | Deploy notices, budget reminders, one-off log spikes                                                                    | **08:00 to 22:00** only; no wake-up intent |

**Quiet hours:** **22:00 to 08:00** America/Toronto. During quiet hours, **only P1 outage** alerts should email **hello@we-met.link**. Queue backlog, DLQ depth, Workers Issues, and other non-outage signals wait until **08:00** unless the condition is also classified as P1.

When wiring automations in Cloudflare or a vendor UI, use separate notification policies for P1 (always notify) versus P2/P4 (**hold until 08:00** America/Toronto when the signal fires during quiet hours). Exact UI steps live in the ticket that adds each monitor ([M3](../monitoring-plan.md#5-proposed-build-tickets), [M5](../monitoring-plan.md#5-proposed-build-tickets), [M6](../monitoring-plan.md#5-proposed-build-tickets)).

## Alert content (privacy)

Follow [monitoring-plan.md](../monitoring-plan.md) §3.7: issue title, counts, slugs, error codes, and dashboard links only. **Never** include visitor email, message bodies, queue payloads, or secrets in notification text.

## Related runbooks

- [Monitoring probe card](./monitoring-probe.md) (synthetic check URL and marker)
- [Incident notes](./incident.md) (customer and owner comms during an event)
- [Kill switch and caps](./kill-switch-and-caps.md)
