# Monitoring probe card (production)

**Purpose:** Document the **live production card** used by external uptime checks ([monitoring-plan.md](../monitoring-plan.md) §3.2, ticket **M5**). Diadem chose a **dedicated test probe card**, not the maintainer `didi` card ([DIDI-861](https://linear.app/didi-build/issue/DIDI-861) answer **2a**).

**Scope:** Operator documentation only. Production **card rows** change only through the **app editor** on `app.we-met.link` (published content in production D1, `we-met-db`). This runbook does **not** change Worker code, Wrangler, or repo config. **Synthetic monitor wiring** (Health Checks, external uptime URL and assertions) is separate **[M5](../monitoring-plan.md#5-proposed-build-tickets)** work and needs **Diadem** approval before go-live.

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

Synthetic checks (Cloudflare Health Checks, Instatus or Better Stack only after CTO and Diadem vendor approval per [monitoring-plan.md](../monitoring-plan.md) §3.7, or similar) must assert this exact substring appears in the HTML:

```text
we-met-card-availability-probe
```

This string is **not** secret. It only proves the card page rendered real app HTML (not a generic CDN error page). Name aligns with the gallery bundle probe (`we-met-gallery-bundle-probe` in [gallery/gallery-probe-marker.ts](../../gallery/gallery-probe-marker.ts)); the production card marker is independent of gallery builds.

### Where to put the marker on the card

1. Sign in on **`app.we-met.link`** with the account whose sign-in email is **`hello@we-met.link`**, and **only** that account. Do not publish the probe card from a personal or other ops sign-in.
2. Open the card editor and go to **About me**.
3. Add or edit one short paragraph so the marker appears **verbatim** in the published page (for example last line: `we-met-card-availability-probe`).
4. Optional human-readable line above the marker: explain the card is for automated uptime checks only and is not a customer-facing profile.
5. **Publish** the card so production D1 serves the new content.

After publish, verify manually (no exchange submit):

```bash
curl -sS "https://we-met.link/hi/<your-probe-slug>" | grep -F 'we-met-card-availability-probe'
```

Expect exit code **0** and one match. Do not paste full HTML into tickets; the grep line is enough.

## Public card, vCard, and exchange (privacy)

The probe URL is **public**. Contact exchange is possible even though uptime checks must stay GET-only; misconfiguration can still expose owner contact data to a visitor who submits the form.

### Sign-in account (required)

The probe card must belong to the account whose **`accounts.email`** is **`hello@we-met.link`**. That value comes from **sign-in**, not from a field on the card editor. Before publish, confirm in the app that you are signed in as **`hello@we-met.link`** only.

### Where the vCard email comes from

`buildVCard` in `src/lib/hi/vcard.ts` always emits:

```text
EMAIL;TYPE=INTERNET,WORK:<ownerEmail argument>
```

The app passes **`ownerEmail` from the signed-in account** (`accounts.email`). It is **not** an editable card field. Changing display copy on the card does **not** change vCard email; only signing in under a different account would.

The same **`hello@we-met.link` only, no phone** rule applies to the JSON body of a successful **`POST /api/exchange`**: **`ownerEmail`** is the account email and optional **`ownerPhone`** comes from **`contact.phone`** on the card ([account-deletion.md](./account-deletion.md), row `api.exchange_post_success_body`). That response is not stored server-side but remains in the visitor browser for that tab.

### Card fields that map into the vCard (lines 57 to 90)

Keep every emitted field **neutral** (for example `we-met probe`) or **empty**. **No** personal or customer names, **no** profile photo, **no** phone number.

| vCard property               | Source in `buildVCard`                      | Probe card requirement                                  |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| `N` (structured name)        | `contact.name.family`, `contact.name.given` | Empty or neutral tokens only                            |
| `FN`                         | `contact.name.full`                         | Neutral label only (for example `we-met probe`)         |
| `NICKNAME`                   | `contact.name.nickname` when non-empty      | Leave empty or neutral                                  |
| `ORG`                        | `contact.org`                               | Empty or neutral                                        |
| `TITLE`                      | `contact.title`                             | Empty or neutral                                        |
| `EMAIL;TYPE=INTERNET,WORK`   | `options.ownerEmail` (sign-in account)      | **`hello@we-met.link` only** via sign-in account above  |
| `TEL;TYPE=CELL`              | `contact.phone` when non-empty              | **Empty** (omit line; no `ownerPhone` in exchange JSON) |
| `PHOTO;ENCODING=b;TYPE=JPEG` | card photo when present                     | **No photo** uploaded                                   |
| `URL` (each entry)           | `contact.urls[]` with optional `TYPE`       | Empty list or neutral URLs only                         |
| `NOTE`                       | `contact.vcardNote`                         | Empty or neutral                                        |

Also keep the **public display name** on the card (page header) neutral; it is visible on `GET /hi/<slug>` even when exchange is unused.

Re-check all of the above after every publish.

## Lead sinks (must stay off)

In the app editor, confirm **no enabled email lead sinks** on the probe card.

If the sink UI is unavailable, run a **read-only** check in production D1 under [Production (`we-met-db`)](./d1-operator-sql.md#production-we-met-db) in [d1-operator-sql.md](./d1-operator-sql.md) (production approval discipline and second pair of eyes for destructive SQL; this query is read-only). Resolve `card_id` from the app, not from git. **Never** change lead sinks with direct SQL (`INSERT`, `UPDATE`, or `DELETE` on `lead_sinks`).

```bash
npx wrangler d1 execute WE_MET_DB --remote \
  -c wrangler.ci.jsonc \
  --command "SELECT id, enabled FROM lead_sinks WHERE card_id = '<card-uuid-from-app>' AND enabled = 1;"
```

Expect **zero rows**. Use the production config steps in [d1-operator-sql.md](./d1-operator-sql.md#production-we-met-db) to prepare `wrangler.ci.jsonc` before `--remote`.

Probes must **never** `POST /api/exchange` on this card. GET-only checks send no mail when sinks are disabled.

## Recreate the probe card

Use this when the card was deleted, the slug was renamed, or production D1 was restored without the probe row.

1. **Account:** Sign in on **`app.we-met.link`** with the account whose sign-in email is **`hello@we-met.link`**, and **only** that account. Do not use a personal sign-in or another internal ops account.
2. **Create or reclaim slug:** Pick a new lowercase slug (placeholder pattern: `<your-probe-slug>`). Avoid `didi` and avoid slugs used by real customers.
3. **Minimal profile:** Follow [Public card, vCard, and exchange (privacy)](#public-card-vcard-and-exchange-privacy): sign-in **`hello@we-met.link` only**; all vCard-mapped contact fields neutral or empty; **no photo**; **no phone**.
4. **About paragraph:** Include **`we-met-card-availability-probe`** as described above.
5. **Lead sinks:** Leave all sinks **disabled** or unset. Double-check after first publish.
6. **Publish** through the app editor.
7. **Update monitors (M5, Diadem approval):** After [M5](../monitoring-plan.md#5-proposed-build-tickets) is approved and wired, point the synthetic check at `https://we-met.link/hi/<your-probe-slug>` and confirm the marker assertion still matches **`we-met-card-availability-probe`**. Do not change Cloudflare or vendor monitor settings from this doc alone.
8. **Record offline:** Note slug and last-verified date in operator storage (not in git).

## Related docs

- [Alert routing](./alert-routing.md) (where probe failures notify)
- [Incident notes](./incident.md) (if the probe fails during an outage)
- [Monitoring plan](../monitoring-plan.md) (M1, M5, SLO for card availability)
