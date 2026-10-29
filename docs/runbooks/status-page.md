# Status page and Upptime monitors (M5, M9)

**Purpose:** Operator runbook for the public status site at **`status.we-met.link`** and the **Upptime** synthetic checks that cover **[M5](../monitoring-plan.md#5-proposed-build-tickets)** (card page) and **[M9](../monitoring-plan.md#5-proposed-build-tickets)** (hosted status page). Diadem chose **Upptime** for **`status.we-met.link`** ([DIDI-939](https://linear.app/didi-build/issue/DIDI-939), Oct 28, 2026). Parent plan: [DIDI-776](https://linear.app/didi-build/issue/DIDI-776), [monitoring-plan.md](../monitoring-plan.md).

**Audience:** Diadem (GitHub repo, DNS, notification secrets) and operators responding to downtime.

**Scope:** Documentation in **`we-met`** only. Live Upptime config, GitHub Actions, Pages deploy, and DNS live in a **separate repository** (see below). This runbook does **not** create that repo, change Cloudflare, or wire checks. The probe **card** itself is documented in [monitoring-probe.md](./monitoring-probe.md) ([M1](./monitoring-probe.md)).

---

## Repository (separate from `we-met`)

| Item            | Detail                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| **GitHub repo** | **`didi-build/we-met-status`** (public; **not created yet** at the time of this doc)                             |
| **Template**    | Fork or generate from the upstream **[upptime/upptime](https://github.com/upptime/upptime)** template            |
| **Runtime**     | **GitHub Actions** run scheduled HTTP checks and open or update incidents; **GitHub Pages** serves the status UI |
| **Config file** | Upptime uses **`.upptimerc.yml`** in that repo for monitor list, schedule, notifications, and site metadata      |

Implementation PRs for **`we-met-status`** are **out of scope** for [DIDI-942](https://linear.app/didi-build/issue/DIDI-942); this file describes what operators should expect once that repo exists.

---

## Monitors (production checks)

Configure these in **`.upptimerc.yml`** in **`didi-build/we-met-status`**. Align probe URL and marker with [monitoring-probe.md](./monitoring-probe.md); do **not** commit the real probe slug in **`we-met`**.

| Plan row     | Name (suggested)  | URL                                        | Success criteria                                                                                                  |
| ------------ | ----------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **M5**       | Card page (probe) | `https://we-met.link/hi/<your-probe-slug>` | HTTP **200**; response body contains keyword **`we-met-card-availability-probe`** (Upptime **keyword** assertion) |
| **M5 / app** | App host          | `https://app.we-met.link/`                 | HTTP **200** (production app Worker on the app host per [monitoring-plan.md](../monitoring-plan.md) §1.1)         |

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

| Topic           | Detail                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Destination** | **hello@we-met.link** (same operator inbox as [alert-routing.md](./alert-routing.md))                                                                          |
| **Channel**     | Upptime **notification** integration configured in **`.upptimerc.yml`** (for example email via the provider Upptime documents for your chosen channel type)    |
| **Secrets**     | SMTP or API credentials for notifications live **only** in **`didi-build/we-met-status`** **GitHub Actions secrets**, not in **`we-met`** and not in this repo |
| **Severity**    | Treat **M5** probe or app-host failures as **P1 outage** signals per [alert-routing.md](./alert-routing.md) (email at any hour) once notifications are wired   |

Do not paste visitor data, queue payloads, or full HTML bodies into monitor names, issue titles, or alert templates.

---

## Custom domain (`status.we-met.link`)

| Topic               | Detail                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public URL**      | **`https://status.we-met.link`**                                                                                                                                                |
| **Upptime setting** | Set **`status-website.cname`** in **`.upptimerc.yml`** to **`status.we-met.link`** (Upptime publishes Pages with that custom hostname when DNS and Pages settings are complete) |
| **DNS**             | The **Cloudflare DNS record** for **`status.we-met.link`** is **not created yet**; pending **Diadem's approval** and the **`we-met-status`** Pages setup                        |

Until DNS is live, use the default **GitHub Pages** URL from the **`we-met-status`** repo for testing only; do not advertise that URL as the canonical status page.

---

## How to read the status page

Upptime serves a public timeline of component health and incidents.

1. Open **`https://status.we-met.link`** (or the temporary Pages URL before DNS).
2. **Current status:** Green means the latest scheduled checks passed for each listed monitor; red or degraded means at least one monitor is failing or in an open incident.
3. **Components:** Each row maps to one entry in **`.upptimerc.yml`** (for example **Card page** and **App host**). Click a component to see recent uptime percentage and response time graphs.
4. **Active incident:** Shows which monitor failed, when the incident started, and optional manual update text if an operator edited the incident in the Upptime repo or UI workflow.
5. **Past incidents:** Historical outages remain visible for transparency; use them for postmortems and [incident notes](./incident.md).

When an alert email arrives, confirm on the status page **which** monitor failed before triaging Workers or D1. Cross-check card failures with [monitoring-probe.md](./monitoring-probe.md) (slug, marker, publish state).

For user-visible outages after **M9** is live, post a public update on the status page per [incident.md](./incident.md) communication order.

---

## GitHub issues on every failure

Upptime's default workflow opens a **GitHub issue** in the **public** **`didi-build/we-met-status`** repository when a monitor goes down, and closes or updates it when checks recover.

That behavior can flood the issue tracker during flaky networks or short blips. Whether to keep auto-issues, tune thresholds, or disable them is an **open question for Diadem**: [DIDI-959](https://linear.app/didi-build/issue/DIDI-959). Do not change issue automation without that decision.

---

## Related docs

- [Monitoring probe card](./monitoring-probe.md) (probe slug, marker string, privacy rules)
- [Alert routing](./alert-routing.md) (P1 vs quiet hours for other alerts)
- [Incident notes](./incident.md) (status page updates during outages)
- [Monitoring plan](../monitoring-plan.md) (M5, M9, SLO for card availability)
