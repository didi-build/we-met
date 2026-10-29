# Status page and Upptime monitors (M5, M9)

**Purpose:** Operator runbook for the public status site at **`status.we-met.link`** and the **Upptime** synthetic checks that cover **[M5](../monitoring-plan.md#5-proposed-build-tickets)** (card page) and **[M9](../monitoring-plan.md#5-proposed-build-tickets)** (hosted status page). Diadem chose **Upptime** for **`status.we-met.link`** ([DIDI-939](https://linear.app/didi-build/issue/DIDI-939), Oct 28, 2026). Parent plan: [DIDI-776](https://linear.app/didi-build/issue/DIDI-776), [monitoring-plan.md](../monitoring-plan.md).

**Audience:** Diadem (GitHub repo, DNS, notification secrets) and operators responding to downtime.

**Scope:** Documentation in **`we-met`** only. Live Upptime config, GitHub Actions, Pages deploy, and DNS live in a **separate repository** (see below). This runbook does **not** create that repo, change Cloudflare, or wire checks. The probe **card** itself is documented in [monitoring-probe.md](./monitoring-probe.md) ([M1](./monitoring-probe.md)).

---

## Repository (separate from `we-met`)

| Item            | Detail                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **GitHub repo** | **`didi-build/we-met-status`** (public; **not created yet** at the time of this doc)                                                                                                                   |
| **Template**    | **Generate from template** on GitHub from upstream **[upptime/upptime](https://github.com/upptime/upptime)** (repo creation steps tracked in [DIDI-959](https://linear.app/didi-build/issue/DIDI-959)) |
| **Runtime**     | **GitHub Actions** run scheduled HTTP checks and open or update incidents; **GitHub Pages** serves the status UI                                                                                       |
| **Config file** | Upptime uses **`.upptimerc.yml`** in that repo for monitor list, schedule, notifications, and site metadata                                                                                            |

Implementation PRs for **`we-met-status`** are **out of scope** for [DIDI-942](https://linear.app/didi-build/issue/DIDI-942); this file describes what operators should expect once that repo exists.

---

## Monitors (production checks)

Configure these in **`.upptimerc.yml`** in **`didi-build/we-met-status`**. Align probe URL and marker with [monitoring-probe.md](./monitoring-probe.md); do **not** commit the real probe slug in **`we-met`**.

| Plan row     | Name (suggested)  | URL                                        | Upptime site keys (under `sites:` in **`.upptimerc.yml`**)                                                                                                                                |
| ------------ | ----------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M5**       | Card page (probe) | `https://we-met.link/hi/<your-probe-slug>` | **`expectedStatusCodes: [200]`** (Upptime treats any **2xx** or **3xx** as up by default); **`__dangerous__body_down_if_text_missing: we-met-card-availability-probe`** on the probe site |
| **M5 / app** | App host          | `https://app.we-met.link/`                 | **`expectedStatusCodes: [200]`** (production app Worker on the app host per [monitoring-plan.md](../monitoring-plan.md) §1.1)                                                             |

**Probe slug:** Replace `<your-probe-slug>` with the slug published through the app editor; store it in operator notes or **`we-met-status`** monitor config, not in **`we-met`** git. Recreate and verify the card using [monitoring-probe.md](./monitoring-probe.md).

**Privacy:** Upptime checks are **GET-only**. They must **not** `POST /api/exchange` on the probe card. Keep lead sinks disabled on the probe card per [monitoring-probe.md](./monitoring-probe.md).

---

## Schedule and timing

| Topic         | Detail                                                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Interval**  | **Every 5 minutes** (Upptime's minimum interval; do not expect sub-5-minute granularity)                                                                                                                                    |
| **Mechanism** | GitHub Actions **scheduled** workflows in **`we-met-status`**                                                                                                                                                               |
| **Lateness**  | Scheduled Actions can **start late** (queue load, org concurrency, or GitHub incidents). A single late run does not by itself prove the site is healthy; look at the status page incident timeline and consecutive failures |

---

## Alert routing

| Topic           | Detail                                                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Destination** | **hello@we-met.link** (same operator inbox as [alert-routing.md](./alert-routing.md))                                                                                                                       |
| **Channel**     | Upptime **notification** integration configured in **`.upptimerc.yml`** (for example email via the provider Upptime documents for your chosen channel type)                                                 |
| **Secrets**     | SMTP or API credentials for notifications live **only** in **`didi-build/we-met-status`** **GitHub Actions secrets**, not in **`we-met`** and not in this repo                                              |
| **Severity**    | Treat **M5** probe or app-host failures as **P1 outage** signals per [alert-routing.md](./alert-routing.md) (email at any hour) once notifications are wired                                                |
| **Quiet hours** | Upptime notification email has **no quiet-hours schedule** (unlike Cloudflare Monitors M3, M4, and M6 in [alert-routing.md](./alert-routing.md)). Failed checks can email **hello@we-met.link** at any time |

Do not paste visitor data, queue payloads, or full HTML bodies into monitor names, issue titles, or alert templates.

**No status subscribers:** Do **not** enable Upptime or status-page **email subscription** features that collect visitor email addresses for incident updates. Subscriber lists are **PII** under [monitoring-plan.md](../monitoring-plan.md) §3.7; document purpose, retention, and subprocessors before any subscription flow exists.

---

## Custom domain (`status.we-met.link`)

| Topic               | Detail                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public URL**      | **`https://status.we-met.link`**                                                                                                                                                                            |
| **Upptime setting** | Under **`status-website:`**, set **`cname:`** to **`status.we-met.link`** (Upptime key **`status-website.cname`** in docs) when DNS and Pages are ready                                                     |
| **Before DNS**      | Use **`status-website.baseUrl`** (for example **`/we-met-status`**) for the default **GitHub Pages** path until **`cname`** is live; see [Upptime configuration](https://upptime.js.org/docs/configuration) |
| **DNS**             | The **Cloudflare DNS record** for **`status.we-met.link`** is **not created yet**; pending **Diadem's approval** and the **`we-met-status`** Pages setup                                                    |

Until DNS is live, use the **`status-website.baseUrl`** Pages URL from **`we-met-status`** for testing only; do not advertise that URL as the canonical status page.

---

## How to read the status page

Upptime serves a public timeline of component health and incidents.

1. Open **`https://status.we-met.link`** (or the temporary Pages URL before DNS).
2. **Current status:** Green means the latest scheduled checks passed for each listed monitor; red or degraded means at least one monitor is failing or in an open incident.
3. **Components:** Each row maps to one entry in **`.upptimerc.yml`** (for example **Card page** and **App host**). Click a component to see recent uptime percentage and response time graphs.
4. **Active incident:** Shows which monitor failed, when the incident started, and optional manual update text if an operator edited the incident in the Upptime repo or UI workflow.
5. **Past incidents:** Resolved outages appear in history **only if** the backing GitHub issue was kept. Upptime **deletes** issues that stayed open for **under 15 minutes** when they close, unless **`skipDeleteIssues: true`** is set in **`.upptimerc.yml`** (see [Upptime configuration](https://upptime.js.org/docs/configuration)). Short blips may leave **no** past-incident row. Whether to set **`skipDeleteIssues`** is part of [DIDI-959](https://linear.app/didi-build/issue/DIDI-959).

When an alert email arrives, confirm on the status page **which** monitor failed before triaging Workers or D1. Cross-check card failures with [monitoring-probe.md](./monitoring-probe.md) (slug, marker, publish state).

For user-visible outages after **M9** is live, post a public update on the status page per [incident.md](./incident.md) communication order.

---

## GitHub issues on every failure

Upptime **always** opens a **public GitHub issue** in **`didi-build/we-met-status`** when a monitor fails. That behavior is **built into Upptime** and **cannot be turned off**. Issues are updated or closed when checks recover.

That is **immediately public** (issue title and timeline on GitHub) and can conflict with the approved **private updates first** communication order in [incident.md](./incident.md) before a deliberate public status post. Operators should assume every failed check creates public visibility, not only the email to **hello@we-met.link**.

How to reconcile public auto-issues with internal triage and status-page wording is an **open question for Diadem**: [DIDI-959](https://linear.app/didi-build/issue/DIDI-959). Do not change Upptime issue automation without that decision.

---

## Related docs

- [Monitoring probe card](./monitoring-probe.md) (probe slug, marker string, privacy rules)
- [Alert routing](./alert-routing.md) (P1 vs quiet hours for other alerts)
- [Incident notes](./incident.md) (status page updates during outages)
- [Monitoring plan](../monitoring-plan.md) (M5, M9, SLO for card availability)
