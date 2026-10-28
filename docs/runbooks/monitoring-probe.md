# Monitoring probe card (production)

**Purpose:** Document the **live production card** used by external uptime checks ([monitoring-plan.md](../monitoring-plan.md) §3.2, ticket **M5**). Diadem chose a **dedicated test probe card**, not the maintainer `didi` card ([DIDI-861](https://linear.app/didi-build/issue/DIDI-861) answer **2a**).

**Scope:** Production D1 only (`we-met-db`). This runbook does not change code or Cloudflare configuration.

## Rules

| Rule                   | Detail                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Not `didi`**         | Do not use slug `didi` or any personal maintainer card for synthetics.                                                                                                                                              |
| **App editor only**    | Create and publish the probe card on **`app.we-met.link`** through the signed-in app editor ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)).                                             |
| **Never `cards:load`** | Do **not** load this card with `npm run cards:load`. That script is for local and **non-prod** D1 only; production cards publish through the app ([card-loading](./card-loading.md), [AGENTS.md](../../AGENTS.md)). |
| **No lead sinks**      | The probe card must have **zero enabled lead sinks**. Uptime checks only `GET` the public page; they must not enqueue owner mail or visitor follow-up.                                                              |
| **Slug in git**        | Do not commit the real slug, account id, or card JSON. Document the pattern here; store the chosen slug in the operator password manager or Cloudflare monitor notes.                                               |

## Probe URL

External monitors use:

```text
https://we-met.link/hi/<your-probe-slug>
```

Replace `<your-probe-slug>` with the slug you chose when publishing the card (lowercase, unique, not `didi`). Example placeholder only: `monitor-probe` (do not assume that slug exists until you publish it).

**Success criteria for M5:** HTTP **200** and the response body contains the **probe marker** substring below.

## Probe marker string

Synthetic checks (Cloudflare Health Checks, Instatus, Better Stack, or similar) must assert this exact substring appears in the HTML:

```text
we-met-card-availability-probe
```

This string is **not** secret. It only proves the card page rendered real app HTML (not a generic CDN error page). Name aligns with the gallery bundle probe (`we-met-gallery-bundle-probe` in [gallery/gallery-probe-marker.ts](../../gallery/gallery-probe-marker.ts)); the production card marker is independent of gallery builds.

### Where to put the marker on the card

1. Sign in on **`app.we-met.link`** with the operator account that owns the probe card.
2. Open the card editor and go to **About me**.
3. Add or edit one short paragraph so the marker appears **verbatim** in the published page (for example last line: `we-met-card-availability-probe`).
4. Optional human-readable line above the marker: explain the card is for automated uptime checks only and is not a customer-facing profile.
5. **Publish** the card so production D1 serves the new content.

After publish, verify manually (no exchange submit):

```bash
curl -sS "https://we-met.link/hi/<your-probe-slug>" | grep -F 'we-met-card-availability-probe'
```

Expect exit code **0** and one match. Do not paste full HTML into tickets; the grep line is enough.

## Lead sinks (must stay off)

In the app editor, confirm **no enabled email lead sinks** on the probe card. If sink UI is unavailable, verify in D1 that no `lead_sinks` row for this card has `enabled = 1` ([d1-operator-sql](./d1-operator-sql.md); use slug or card id from the app, not from git).

Probes must **never** `POST /api/exchange` on this card. GET-only checks send no mail when sinks are disabled.

## Recreate the probe card

Use this when the card was deleted, the slug was renamed, or production D1 was restored without the probe row.

1. **Account:** Sign in on **`app.we-met.link`** as the operator who will own the probe card (same account as other internal ops cards, not an end-customer test account unless policy changes).
2. **Create or reclaim slug:** Pick a new lowercase slug (placeholder pattern: `<your-probe-slug>`). Avoid `didi` and avoid slugs used by real customers.
3. **Minimal profile:** Set display name and any required fields so the public page renders (photo optional). Keep copy neutral; no personal contact details beyond what the product requires.
4. **About paragraph:** Include **`we-met-card-availability-probe`** as described above.
5. **Lead sinks:** Leave all sinks **disabled** or unset. Double-check after first publish.
6. **Publish** through the app editor.
7. **Update monitors:** In Cloudflare or your uptime vendor, point the synthetic check at `https://we-met.link/hi/<your-probe-slug>` and confirm the marker assertion still matches **`we-met-card-availability-probe`**.
8. **Record offline:** Note slug and last-verified date in operator storage (not in git).

## Related docs

- [Alert routing](./alert-routing.md) (where probe failures notify)
- [Incident notes](./incident.md) (if the probe fails during an outage)
- [Monitoring plan](../monitoring-plan.md) (M1, M5, SLO for card availability)
