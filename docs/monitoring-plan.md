# We Met production monitoring plan

**Status:** draft for maintainer approval ([DIDI-835](https://linear.app/didi-build/issue/DIDI-835), parent [DIDI-776](https://linear.app/didi-build/issue/DIDI-776/we-met-plan-production-monitoring-status-page-alerts-informed-by)).

**Audience:** Diadem (product and Cloudflare account owner), then CTO to split into build tickets.

**Scope:** Production on Cloudflare only. This document does not change code, workflows, or live configuration.

---

## 1. What we run today

Sources: committed Wrangler configs, [`.github/workflows/deploy-production.yml`](../.github/workflows/deploy-production.yml), [`workers/warmup/README.md`](../workers/warmup/README.md), [architecture docs](./architecture/overview.md), [environments](./architecture/environments.md), and [runbooks](./runbooks/kill-switch-and-caps.md).

### 1.1 Production Workers

| Worker name                      | Config                                                                                                                                    | Role                                                                                                                     | Deploy path                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `we-met`                         | [`wrangler.jsonc`](../wrangler.jsonc)                                                                                                     | OpenNext app: card pages, `POST /api/exchange`, `POST /api/details`, app host `app.we-met.link`, card host `we-met.link` | `opennextjs-cloudflare deploy` in **Deploy production**                           |
| `we-met-followup-email-consumer` | [`workers/we-met-followup-email-consumer/wrangler.production.jsonc`](../workers/we-met-followup-email-consumer/wrangler.production.jsonc) | Queue consumer: owner email sinks, visitor letters, ledger updates                                                       | `wrangler deploy` in **Deploy production**                                        |
| `we-met-warmup-cron`             | [`workers/warmup/wrangler.jsonc`](../workers/warmup/wrangler.jsonc)                                                                       | Hourly cron seed mail for `mail.we-met.link` reputation                                                                  | `wrangler deploy --config workers/warmup/wrangler.jsonc` in **Deploy production** |

All three set `workers_dev: false` and have no public Workers.dev URL for the consumer or warmup Worker ([environments](./architecture/environments.md)).

**App Worker bindings (production):** D1 `we-met-db` (`WE_MET_DB`), R2 `we-met-assets` (`WE_MET_ASSETS`), queue producer `we-met-followup-email` (`WE_MET_FOLLOWUP_EMAIL_QUEUE`), rate limiters (exchange **2002**, auth **2004**, app **2006**), Images, and `WORKER_SELF_REFERENCE` ([`wrangler.jsonc`](../wrangler.jsonc)).

**Follow-up consumer bindings:** same D1 and R2 names, `send_email` as `EMAIL` with `allowed_sender_addresses: ["hello@mail.we-met.link"]`, consumes `we-met-followup-email` with `max_retries: 30`, `retry_delay: 30`, `max_batch_size: 5` ([`wrangler.production.jsonc`](../workers/we-met-followup-email-consumer/wrangler.production.jsonc), [0023](./decisions/0023-owner-email-lead-sink-consumer.md)).

**Warmup Worker bindings:** KV `WARMUP_STATE`, `send_email` as `EMAIL` (no `allowed_sender_addresses` in config; domain enforced in code), cron `0 * * * *`, queues as below ([`workers/warmup/wrangler.jsonc`](../workers/warmup/wrangler.jsonc), [warmup README](../workers/warmup/README.md)).

### 1.2 D1, R2, and queues

| Resource                    | Production name              | Used by                                                                                                                                                                                                                                                                                                                                              |
| --------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1                          | `we-met-db`                  | App Worker (read/write cards, leads, settings, ledger on exchange/details), follow-up consumer (ledger updates)                                                                                                                                                                                                                                      |
| R2                          | `we-met-assets`              | App Worker (card photos), consumer (`get` only for vCard attachments)                                                                                                                                                                                                                                                                                |
| Queue (follow-up)           | `we-met-followup-email`      | App produces; consumer consumes. **No `dead_letter_queue` in Wrangler**; exhausted retries are deleted per [Consumer queue handling](./architecture/environments.md#config-and-secret-names) in [environments](./architecture/environments.md) and [Cloudflare DLQ docs](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/) |
| Queue (warmup retry)        | `we-met-warmup-send-retry`   | Warmup producer and consumer; DLQ `we-met-warmup-send-dlq`                                                                                                                                                                                                                                                                                           |
| Queue (warmup email events) | `we-met-warmup-email-events` | Fed by Email Sending event subscription on `mail.we-met.link`; DLQ `we-met-warmup-email-events-dlq`                                                                                                                                                                                                                                                  |

Non-prod uses `*-nonprod` names only; deploy guards reject production resource names in the `previews` block ([`scripts/check-deploy-guards.mjs`](../scripts/check-deploy-guards.mjs), [environments](./architecture/environments.md#deploy-time-guards)).

### 1.3 Cloudflare Email Sending

- **Product mail:** follow-up consumer sends via Workers `send_email` from `hello@mail.we-met.link` (secrets `WE_MET_EMAIL_FROM_CLOUDFLARE`, `WE_MET_FROM_DISPLAY_NAME` enforced at production deploy in [`.github/workflows/deploy-production.yml`](../.github/workflows/deploy-production.yml)).
- **Warmup mail:** separate Worker; `From` only from secret `WARMUP_FROM` (must be on `mail.we-met.link`); seeds from `WARMUP_SEEDS` ([warmup README](../workers/warmup/README.md)).
- **App contact addresses (not the consumer From):** `WE_MET_CONTACT_SENDER_ADDRESSES` in [`wrangler.jsonc`](../wrangler.jsonc) `vars` (`hello@we-met.link`, `hello@mail.we-met.link`).
- **Account quota (operator note):** [environments](./architecture/environments.md) documents **200 messages per day** for Cloudflare Email Service as **UNVERIFIED** against the dashboard; app caps (`daily_cap_global` 150, `daily_cap_per_card` 50) are enforced at enqueue in D1 ([kill-switch runbook](./runbooks/kill-switch-and-caps.md)).

### 1.4 Monitoring and safety controls already in the repo

These are **not** a full observability program, but they are the production signals and guardrails that exist today.

#### Workers Observability (logs, traces, Issues config)

Committed config on **app** and **follow-up consumer** (production):

- `observability.logs`: `enabled: true`, `head_sampling_rate: 1`, `invocation_logs: true`, `persist: true`
- `observability.traces`: `enabled: true`, `head_sampling_rate: 1`, `persist: true`
- `observability.issues`: `enabled: true` ([`wrangler.jsonc`](../wrangler.jsonc), [`wrangler.production.jsonc`](../workers/we-met-followup-email-consumer/wrangler.production.jsonc); [DIDI-860](https://linear.app/didi-build/issue/DIDI-860))

Cloudflare documents **Workers Issues** under `observability.issues.enabled` ([Issues docs](https://developers.cloudflare.com/workers/observability/issues/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)). **UNVERIFIED:** after [DIDI-860](https://linear.app/didi-build/issue/DIDI-860) deploys, confirm Issues grouping and automations in the dashboard.

**Warmup Worker:** logs only (`persist: true`, `head_sampling_rate: 1`); no traces or Issues config in [`workers/warmup/wrangler.jsonc`](../workers/warmup/wrangler.jsonc).

#### Structured log events (mail and exchange)

Documented event names for debugging (no PII in listed fields): app `exchange_visitor_letter_enqueue_failed`; consumer visitor, sink, and ledger events in the **Consumer logs** table under [Config and secret names](./architecture/environments.md#config-and-secret-names) in [environments](./architecture/environments.md).

#### Lead email kill switch and daily caps (D1 `app_settings`)

- `lead_email_enabled`: off unless value is `1` or `true` (case-insensitive); missing defaults to **on**
- `daily_cap_global` / `daily_cap_per_card`: non-positive or invalid values **fail closed** with **503** `lead_email_unavailable` on exchange and details
- Consumer re-reads `lead_email_enabled` and acks without send when off ([kill-switch runbook](./runbooks/kill-switch-and-caps.md), [overview pipeline](./architecture/overview.md#pipeline-flow))

#### Warmup kill switch, caps, and auto-pause (KV `WARMUP_STATE`)

| Control            | Mechanism                                                                                                                                                              | Source                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Manual kill switch | KV key `enabled` must be exactly `true` to send                                                                                                                        | [warmup README](../workers/warmup/README.md)                                            |
| Auto-pause         | On `E_RECIPIENT_SUPPRESSED` or `E_ACCOUNT_SUSPENDED` from `send_email`, or async hard bounce/complaint for **seed** recipients; writes `paused`                        | [warmup README](../workers/warmup/README.md), `workers/warmup/lib/pause.ts`             |
| Send caps          | 15 sends per UTC day, 220 per UTC month                                                                                                                                | [warmup README](../workers/warmup/README.md)                                            |
| Alert email        | Secret `WARMUP_ALERT_TO`: one-shot pause alert per episode; non-seed bounce/complaint urgent alerts with hourly rate limit (default 5 individual alerts, then summary) | [warmup README](../workers/warmup/README.md), `workers/warmup/lib/email-event-alert.ts` |

#### Deploy and change control (not runtime monitoring)

- Production deploy requires GitHub **`production`** environment approval ([`deploy-production.yml`](../.github/workflows/deploy-production.yml), [0007](./decisions/0007-production-deploy-manual.md)).
- `scripts/check-deploy-guards.mjs` blocks wrong bindings (non-prod queue/D1 on production, and the reverse) ([environments](./architecture/environments.md#deploy-time-guards)).
- **No** automated rollback on failed health checks ([rollback runbook](./runbooks/rollback.md)).

#### Gaps called out in repo docs (relevant to monitoring)

- Follow-up queue has **no DLQ**; permanent failures are log lines only (`lead_sink_permanent_failure`, `visitor_followup_permanent_failure`, etc.).
- `daily_send_counts` measure **enqueue**, not delivery success ([kill-switch runbook](./runbooks/kill-switch-and-caps.md)).
- Visitor follow-up has **no** `lead_delivery_ledger` row ([environments](./architecture/environments.md#known-gaps-unverified)).
- No dedicated status page, synthetic check, or paging policy is defined in git today ([DIDI-776](https://linear.app/didi-build/issue/DIDI-776)).

---

## 2. Research summary

How teams typically monitor small SaaS and larger products, with sources. We Met should adopt the **ideas**, not every tool listed.

### 2.1 Golden signals, SLOs, and error budgets

- **Four golden signals:** latency, traffic, errors, saturation. Prefer these over ad hoc metrics when choosing what to watch ([Google SRE Book, ch. 6](https://sre.google/sre-book/monitoring-distributed-systems/)).
- **SLOs:** express reliability as a target users care about (for example "99.9% of card page loads succeed in under 2s"); derive an **error budget** as `1 - SLO` and write a policy for when the budget is spent ([Implementing SLOs](https://sre.google/workbook/implementing-slos/), [error budget policy](https://sre.google/workbook/error-budget-policy/), [introduction](https://sre.google/sre-book/introduction/)).
- **Alerting on SLOs:** page on significant budget burn, not on every blip ([Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)).

### 2.2 Uptime and synthetic checks

- **Black-box checks** (HTTP from outside Cloudflare) catch DNS, TLS, routing, and "user cannot load the card" failures that internal metrics miss; SRE guidance pairs white-box (logs, traces) with modest black-box monitoring ([Google SRE Book, ch. 6](https://sre.google/sre-book/monitoring-distributed-systems/)).
- **Cloudflare Health Checks** probe an origin or hostname from the edge, support notifications (email and webhooks on paid plans), and are included from the **Pro** zone plan upward ([Health Checks](https://developers.cloudflare.com/health-checks/), [notifications](https://developers.cloudflare.com/health-checks/how-to/health-checks-notifications/), [plan matrix](https://developers.cloudflare.com/health-checks/#availability)).
- **Dedicated uptime vendors** (Better Stack, Instatus, and others) bundle multi-region HTTP checks, status pages, and incident comms; many offer a free tier for early-stage teams ([Better Stack pricing](https://betterstack.com/pricing), [Instatus pricing](https://instatus.com/pricing)).

### 2.3 Error tracking and logs

- **Workers Issues:** groups 5xx, uncaught exceptions, and error logs without an SDK when enabled with `observability.issues.enabled` ([Issues](https://developers.cloudflare.com/workers/observability/issues/), [investigate](https://developers.cloudflare.com/workers/observability/issues/investigate/)).
- **Workers Logs and traces:** persisted telemetry with configurable sampling ([Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), [Traces](https://developers.cloudflare.com/workers/observability/traces/)).
- **Logpush / OpenTelemetry export:** for longer retention or a SIEM; Workers Logpush is billed per request on Paid plans ([Workers pricing, Logpush](https://developers.cloudflare.com/workers/platform/pricing/)).
- **Third-party error tracking (example: Sentry):** strong for stack traces, release tracking, and cross-service context; free Developer tier exists with quotas ([Sentry pricing](https://sentry.io/pricing/), [Developer plan limits](https://sentry.zendesk.com/hc/en-us/articles/26206897429275-Changes-to-our-Developer-plan)). Prefer Cloudflare Issues plus logs first; add Sentry only if triage still gaps after M0.

### 2.4 Metrics and queues

- **Queue backlog** is a standard saturation signal: Cloudflare exposes backlog message count and bytes via the `queuesBacklogAdaptiveGroups` dataset ([Queues metrics](https://developers.cloudflare.com/queues/observability/metrics/)).
- **Threshold monitors** run SQL API queries on a schedule and can notify via email or webhook ([Cloudflare Monitors](https://developers.cloudflare.com/notifications/monitors/)). **UNVERIFIED:** whether `queuesBacklogAdaptiveGroups` appears in the Monitors dataset picker for this account; confirm in the dashboard before treating M3/M4 as done.
- **Email Sending** has metrics and logs in the dashboard ([Email metrics](https://developers.cloudflare.com/email-service/observability/metrics-analytics/), [Email logs](https://developers.cloudflare.com/email-service/observability/logs/)).

### 2.5 Alerting, on-call, and alert fatigue

- **Outputs:** pages (urgent human action), tickets (days), logs (later analysis). Do not rely on unread email as a paging path ([Google SRE Book, production best practices](https://sre.google/sre-book/service-best-practices/)).
- **Good pages:** urgent, actionable, symptom-based (user-visible), not "something looks weird" ([Monitoring distributed systems](https://sre.google/sre-book/monitoring-distributed-systems/), [incident management guide](https://sre.google/resources/practices-and-processes/incident-management-guide/), [Being on-call](https://sre.google/sre-book/being-on-call/)).
- **One-person team:** prefer **email or mobile push during waking hours**; reserve SMS/phone for true outages; use **repeat notification intervals** to avoid storms ([Cloudflare Monitors, repeat interval](https://developers.cloudflare.com/notifications/monitors/)).

### 2.6 Status pages and incident communication

- **Public status page:** builds trust during incidents; can be manual (post when you know) or tied to monitors ([Instatus pricing and plan types](https://instatus.com/pricing)).
- **Incident notes:** this repo already has a lightweight template ([incident runbook](./runbooks/incident.md)); link status updates and Linear tickets there.

### 2.7 What similar-stage teams often do

| Pattern                      | Typical approach                                                              | Example sources                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Solo founder / one engineer  | Provider logs plus a handful of external HTTP checks and email alerts         | [Cloudflare Health Checks](https://developers.cloudflare.com/health-checks/), [Instatus Starter](https://instatus.com/pricing) |
| Small SaaS with paying users | SLO on core flow, external uptime, status page, weekly review of error budget | [Implementing SLOs](https://sre.google/workbook/implementing-slos/)                                                            |
| Larger SaaS                  | PagerDuty/Opsgenie rotation, Logpush to SIEM, multi-region synthetics         | [Being on-call](https://sre.google/sre-book/being-on-call/)                                                                    |

We Met is in the first row today, moving toward the second after public cutover ([DIDI-566](https://linear.app/didi-build/issue/DIDI-566)).

---

## 3. Recommendation (one-person team, Cloudflare-first)

### 3.1 Principles

1. **Symptom alerts:** "visitors cannot load a card" and "owner mail is not being delivered" matter; raw D1 CPU does not.
2. **Cloudflare-native first:** Workers Observability, Queues metrics, Monitors, Health Checks, Email Sending analytics, Notifications webhooks.
3. **No overnight paging** except **confirmed user-visible outage** (synthetic check failure plus 5xx spike, or follow-up backlog growing with delivery failures).
4. **Minimize PII in alerts:** use slugs, counts, and error codes; never queue payloads or visitor emails in notifications (aligned with [data-map](./privacy/data-map.yml)).

### 3.2 What to monitor

#### Per Worker

| Worker                           | Traffic / errors                                                                                                                                               | Saturation / dependencies                                                              | Existing hooks                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `we-met`                         | 5xx rate on `GET /hi/*`, `POST /api/exchange`, `POST /api/details`; Turnstile 403 rate (abuse, not outage); `exchange_visitor_letter_enqueue_failed` log count | D1 errors in traces; rate limiter 429 rate                                             | Logs, traces; `observability.issues.enabled` in Wrangler (see §1.4) |
| `we-met-followup-email-consumer` | `lead_sink_permanent_failure`, `visitor_followup_permanent_failure`, `cloudflare_send_permanent_failure`                                                       | Queue backlog on `we-met-followup-email`; Email Sending bounces/complaints (dashboard) | Logs, traces; `observability.issues.enabled` in Wrangler (see §1.4) |
| `we-met-warmup-cron`             | Cron invocation failures; `warmup_email_event_alert_*` logs                                                                                                    | KV read failures; DLQ depth on warmup DLQs                                             | Logs; `WARMUP_ALERT_TO` email                                       |

#### Per user-facing flow

| Flow                     | SLI (measurement)                                                                                                                                                                                                  | Suggested alert (daytime email)                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Card page**            | Synthetic `GET https://we-met.link/hi/<probe-slug>` returns 200 and expected substring                                                                                                                             | 2 of 3 regions fail for 5 minutes                                                                |
| **Exchange submit**      | Synthetic or canary `POST /api/exchange` with Turnstile test key **only on non-prod**; production: monitor 5xx rate on `/api/exchange` via Workers analytics / Issues (after M0)                                   | 5xx share above SLO burn threshold                                                               |
| **Owner email delivery** | Rising `messages` backlog ([Queues metrics](https://developers.cloudflare.com/queues/observability/metrics/)) **or** spike in `lead_sink_permanent_failure`; ledger reaches `status = 'sent'` for email sink phase | Backlog &gt; N messages for 30 minutes **and** at least one permanent failure log in same window |
| **Visitor letter**       | `visitor_followup_permanent_failure` rate; optional ledger gap accepted per [environments](./architecture/environments.md#known-gaps-unverified)                                                                   | Any permanent failure cluster (&gt;3 in 1 hour)                                                  |
| **Warmup / reputation**  | Existing `WARMUP_ALERT_TO` path                                                                                                                                                                                    | Keep; add dashboard check on `paused` KV key weekly                                              |
| **DLQ depth**            | `we-met-warmup-send-dlq`, `we-met-warmup-email-events-dlq` via Queues metrics                                                                                                                                      | &gt; 0 messages for 15 minutes                                                                   |
| **Follow-up queue**      | No DLQ today: monitor **backlog** and **permanent failure logs** instead                                                                                                                                           | Backlog sustained high with rising retries                                                       |

**Probe slug:** use a dedicated **live** card in production D1, published through the **app editor** on `app.we-met.link`. **Never** load the probe card with `npm run cards:load` (production cards publish through the app; `cards:load` is for local/non-prod D1 only per [AGENTS.md](../AGENTS.md) and [card-loading](./runbooks/card-loading.md)).

### 3.3 Tooling choices

| Need                      | Recommendation                                                                                                                           | Why                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Errors and 5xx            | **Workers Issues** (`observability.issues.enabled`; [DIDI-860](https://linear.app/didi-build/issue/DIDI-860)) plus dashboard automations | Native grouping ([Issues](https://developers.cloudflare.com/workers/observability/issues/)); dashboard behavior **UNVERIFIED** until post-deploy check   |
| Logs and traces           | **Workers Observability** (100% head sampling today)                                                                                     | Reduce sampling after baseline if [Observability pricing](https://developers.cloudflare.com/observability/pricing/) bites (post Dec 2026 unified model)  |
| Long retention            | **Logpush** to R2 or S3 **only if** compliance or postmortems need &gt;7 days                                                            | [Workers Logpush pricing](https://developers.cloudflare.com/workers/platform/pricing/)                                                                   |
| Custom metrics / SLO math | **Workers Analytics Engine** for counters (exchange success, enqueue failures)                                                           | Optional second phase; [Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/)                                 |
| Queue backlog             | **Cloudflare Monitors** on `queuesBacklogAdaptiveGroups` **UNVERIFIED** for Monitors UI                                                  | [Queues metrics](https://developers.cloudflare.com/queues/observability/metrics/), [Monitors](https://developers.cloudflare.com/notifications/monitors/) |
| External uptime           | **Cloudflare Health Checks** (if zone is Pro+) **or** Instatus/Better Stack free monitors                                                | Health Checks need paid zone plan ([availability table](https://developers.cloudflare.com/health-checks/#availability))                                  |
| Status page               | **Instatus Starter (free, public page only)** or **no hosted page** (incident runbook only) until paid                                   | [Instatus pricing](https://instatus.com/pricing)                                                                                                         |
| Third-party APM           | **Defer Sentry** unless Issues plus logs are insufficient                                                                                | Overlap with Workers Issues ([Sentry pricing](https://sentry.io/pricing/)); vendor adoption needs §3.7                                                   |

### 3.4 Alert routing (proposed)

| Severity                   | When                                                                   | Channel                                              | Hours                                                |
| -------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| **P1 Outage**              | Synthetic card check failed AND elevated 5xx on `we-met`               | Email + optional SMS (if on Instatus Pro or similar) | Any time, expected rare                              |
| **P2 Degraded**            | Follow-up backlog high with delivery failures; Email account suspended | Email to operator                                    | 08:00 to 22:00 America/Toronto (adjust to Diadem TZ) |
| **P3 Reputation / warmup** | Warmup auto-pause, non-seed bounce summary                             | Existing `WARMUP_ALERT_TO`                           | As today                                             |
| **P4 Informational**       | Daily budget alerts, deploy completed                                  | Email or GitHub notification                         | No wake-up                                           |

**No PagerDuty** until there is a second on-call engineer ([Being on-call](https://sre.google/sre-book/being-on-call/)).

### 3.5 Status page approach

| Option                                                             | Pros                                       | Cons                                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **No hosted page (default)**                                       | Zero cost, no subscriber PII               | Users rely on owner comms during incidents                                                          |
| **Instatus Starter (free)**                                        | Free monitors and a **public** status page | Page is public only; no custom domain on Starter ([Instatus pricing](https://instatus.com/pricing)) |
| **Instatus Private Pro ($50/mo)** or **Select ($100/mo)**          | Password, allowlists, or audience controls | Paid; **CTO + Diadem** approval ([Instatus pricing](https://instatus.com/pricing))                  |
| **Public `status.we-met.link` on Instatus Pro ($20/mo) or higher** | Custom domain on public page               | DNS plus paid tier; **CTO + Diadem** decision                                                       |

**Recommendation:** start with the [incident runbook](./runbooks/incident.md) and Cloudflare notification history; add a **hosted** page only after §3.7 review. Do not use Instatus Starter if a non-public page is required.

### 3.6 Rough monthly cost

**Date checked:** 2026-10-26 (vendor pages below; **We Met's actual zone plan and traffic are unknown** without dashboard access).

| Line item                                  | Assumption                                                   | Source                                                                                                                                                | Monthly estimate                                                            |
| ------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Workers Paid base                          | Account already on Workers Paid for production Workers       | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)                                                                        | **$5** minimum                                                              |
| Workers Logs / traces                      | Low traffic (&lt;20M log events/mo at current 100% sampling) | [Workers pricing, Workers Logs table](https://developers.cloudflare.com/workers/platform/pricing/)                                                    | **$0** incremental (within included 20M until Dec 2026)                     |
| Observability unified pricing              | After 2026-12-01, ingestion-based                            | [Observability pricing](https://developers.cloudflare.com/observability/pricing/)                                                                     | **Unknown** until measured; reduce `head_sampling_rate` if over 50 GB/cycle |
| Workers Analytics Engine (M8)              | Low volume counters                                          | [Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/) (checked 2026-10-26; **not billed yet** per vendor) | **$0** today; **Unknown** once billing starts ($0.25/million writes quoted) |
| Workers Logpush (M12)                      | Only if enabled                                              | [Workers Logpush pricing](https://developers.cloudflare.com/workers/platform/pricing/) (10M requests/mo included, +$0.05/million)                     | **$0** if disabled; **Unknown** at We Met log volume if enabled             |
| Queues                                     | &lt;1M operations/mo at We Met scale                         | [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)                                                                          | **$0** (within 1M included)                                                 |
| Cloudflare zone plan                       | **Unknown** (Free vs Pro affects Health Checks)              | [Cloudflare plans](https://www.cloudflare.com/plans/), [Health Checks availability](https://developers.cloudflare.com/health-checks/#availability)    | **$0** (Free) or **$20** (Pro)                                              |
| External monitors + public status          | Instatus Starter                                             | [Instatus pricing](https://instatus.com/pricing)                                                                                                      | **$0**                                                                      |
| Optional Instatus Pro (custom domain, SMS) | If chosen                                                    | [Instatus pricing](https://instatus.com/pricing)                                                                                                      | **$20**                                                                     |
| Sentry (not recommended initially)         | Developer free tier                                          | [Sentry pricing](https://sentry.io/pricing/)                                                                                                          | **$0**                                                                      |

**Planning range (excluding unknown zone plan and unmeasured Logpush/Analytics Engine billing):** about **$5 to $25/mo** Cloudflare + **$0 to $20/mo** optional status/uptime vendor.

### 3.7 Privacy and vendor compliance

Before enabling any **new vendor** (Instatus, Better Stack, Sentry, AWS S3 for log archive, or similar):

- Update [`docs/privacy/subprocessors.yml`](./privacy/subprocessors.yml) and the public privacy page ([subprocessors runbook context](./privacy/subprocessors.md)).
- **CTO + Diadem** approval for vendor choice, regions, and DPA posture.

Monitoring-specific notes:

- **Status page subscribers:** email addresses collected for incident updates are **PII**; document purpose, retention, and processor in the data map if we enable subscriptions.
- **M12 (Logpush):** exported Worker logs can include `leadId`, `photoKey`, and URLs longer than the default **7-day** Workers Logs retention ([Workers Logs limits](https://developers.cloudflare.com/workers/observability/logs/workers-logs/#limits)); treat as extended retention of operational identifiers and scrub or restrict destinations.
- **M8 (Analytics Engine binding):** add a `data-map.yml` entry for any new binding and emitted dimensions before production write traffic.
- **M9 (status page):** public comms and subscriber data; **CTO + Diadem**.
- **Alert content:** automations (M6) must send only issue title and dashboard link; no visitor email, message bodies, or queue payloads.

---

## 4. Proposed SLOs (user-facing flows)

Rolling **30-day** window; measured from **synthetic + Workers analytics** (not yet implemented). Error budgets use [Google's definition](https://sre.google/workbook/error-budget-policy/). Ledger statuses are `queued`, `sent`, and `failed` only ([`migrations/0002_lead_delivery_ledger.sql`](../migrations/0002_lead_delivery_ledger.sql)).

| Flow                       | SLI                                                                                       | SLO target                    | Error budget (30d)                        | Notes                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| **Card availability**      | Successful synthetic GET (200, body contains probe marker)                                | **99.9%**                     | ~43 minutes downtime                      | Aligns with "can open the card"                                          |
| **Exchange acceptance**    | `POST /api/exchange` returns 2xx excluding honeypot fake 200                              | **99.5%**                     | ~3.6 hours                                | Excludes 429 abuse and 503 when kill switch intentionally on             |
| **Owner email timeliness** | Time from successful exchange to ledger `status = 'sent'` for the email sink record phase | **99%** within **15 minutes** | 1% of exchanges may exceed 15 min or fail | Queue retries up to ~12h; SLO forces backlog alerting before max retries |

**Not an SLO (operational guardrails):** warmup send caps, `lead_email_enabled`, Turnstile pass rate.

When an SLO budget is exhausted in a month, proposed policy: **freeze non-urgent production deploys** and prioritize reliability tickets ([error budget policy](https://sre.google/workbook/error-budget-policy/)). **Diadem must confirm** targets and freeze rules (open question §6).

---

## 5. Proposed build tickets

Each row is one PR unless noted. **Diadem** = Cloudflare account, secrets, or product choice. **CTO + Diadem** = vendor, privacy, or public comms.

| ID (suggested) | Title                                                                                      | Acceptance criterion                                                                                                                                                     | Owner approval                          |
| -------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| M0             | Fix Workers Issues Wrangler key ([DIDI-860](https://linear.app/didi-build/issue/DIDI-860)) | `observability.issues.enabled` in app and both consumer wrangler configs ([DIDI-860](https://linear.app/didi-build/issue/DIDI-860)); dashboard shows Issues after deploy |                                         |
| M1             | Document probe slug runbook                                                                | `docs/runbooks/monitoring-probe.md`: probe card published via app editor only, never `cards:load`                                                                        |                                         |
| M2             | Add follow-up queue DLQ in Wrangler                                                        | `we-met-followup-email-dlq` bound; consumer config documents operator replay steps                                                                                       | Diadem (create queue in dashboard)      |
| M3             | Cloudflare Monitor: follow-up backlog                                                      | Monitor fires email when `we-met-followup-email` backlog &gt; threshold 30 minutes (dataset **UNVERIFIED**)                                                              | Diadem (notification email/webhook)     |
| M4             | Cloudflare Monitor: warmup DLQ non-zero                                                    | Alert when either warmup DLQ has messages &gt; 0 for 15 minutes (dataset **UNVERIFIED**)                                                                                 | Diadem                                  |
| M5             | Synthetic check: card page                                                                 | External or Health Check on probe URL; failure notifies operator                                                                                                         | Diadem (zone plan / Instatus account)   |
| M6             | Workers Issues automation                                                                  | Automation emails issue title and Issues dashboard link only; no visitor or queue payload fields                                                                         | Diadem (dashboard automation)           |
| M7             | Reduce log/trace sampling                                                                  | `head_sampling_rate` tuned; comment in Wrangler cites cost check date                                                                                                    | Diadem (cost decision; open question 8) |
| M8             | Analytics Engine counters for exchange                                                     | Emit `exchange_outcome` counter by status class; `data-map.yml` updated for binding                                                                                      | Diadem (binding + data map)             |
| M9             | Status page (if approved)                                                                  | Hosted status page linked from internal runbook; subprocessors updated if vendor used                                                                                    | CTO + Diadem                            |
| M10            | SLO dashboard                                                                              | Single Cloudflare dashboard or doc section showing 30d SLI vs targets                                                                                                    |                                         |
| M11            | Incident comms template                                                                    | Extend [incident.md](./runbooks/incident.md) with status page + customer email boilerplate                                                                               |                                         |
| M12            | Optional Logpush to R2                                                                     | Runbook or config for log export; privacy review for extended retention                                                                                                  | CTO + Diadem                            |

**Any PR that adopts Instatus, Better Stack, Sentry, or non-Cloudflare log storage** needs **CTO + Diadem** before merge, even if not listed above.

---

## 6. Open questions for Diadem

Plain questions for approval from a phone:

1. What **Cloudflare zone plan** is `we-met.link` on today (Free vs Pro)? This decides whether **Health Checks** are available without a third-party monitor.
2. Should **synthetic monitoring** hit a **real live slug** in production, and who owns creating that probe card (via the app editor)?
3. Do you want a **public status page** before general launch, or only **private** incident comms for now?
4. If public, preferred host: **`status.we-met.link`**, Instatus subdomain, or other?
5. What **email address** should receive **P2** (degraded mail/backlog) alerts during the day? (Warmup already uses `WARMUP_ALERT_TO` for reputation.)
6. Are **SMS or phone** alerts acceptable for **P1 outage**, or email only at all hours?
7. What **timezone and quiet hours** should define "no non-outage alerts overnight"?
8. Is **100% log/trace sampling** in production acceptable cost-wise after [Observability pricing changes on 2026-12-01](https://developers.cloudflare.com/observability/pricing/), or should we lower sampling in M7 first?
9. Should exhausted follow-up messages get a **DLQ** (M2) so nothing is silently deleted after 30 retries?
10. Any **compliance** need for log retention beyond **7 days** ([Workers Logs retention](https://developers.cloudflare.com/workers/observability/logs/workers-logs/#limits))?
11. Do you accept the proposed **SLO targets** (99.9% card availability, 99.5% exchange acceptance, 99% owner email within 15 minutes) and the **deploy freeze** when the monthly error budget is spent?

---

## References (internal)

- [DIDI-835](https://linear.app/didi-build/issue/DIDI-835), [DIDI-776](https://linear.app/didi-build/issue/DIDI-776)
- [Architecture overview](./architecture/overview.md), [Environments](./architecture/environments.md)
- [Kill switch and caps](./runbooks/kill-switch-and-caps.md), [Rollback](./runbooks/rollback.md), [Incident notes](./runbooks/incident.md)
- [Warmup Worker README](../workers/warmup/README.md)
