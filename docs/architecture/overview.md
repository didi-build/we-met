# Architecture overview — We Met

## Purpose

**We Met** hosts digital exchange-contact cards: a visitor opens a card URL, shares their details, and both sides get email with the exchange. The MVP adds Google sign-in, a card editor on the app host, and per-account published cards on `/hi/<slug>` ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)).

## Boundaries

**This repo owns**

- The Next.js app (UI, `/api/exchange` and `/api/details` handlers, card rendering).
- Cloudflare Workers deployment (OpenNext), `we-met-*` queues, consumers, D1, R2, and env-specific bindings.
- Card presentation, theming tokens, and the contact-exchange pipeline through to **visitor** follow-up email and **lead sink dispatch** ([0018](../decisions/0018-lead-sink.md)).

**Out of scope**

- The `didi-build/web` monolith at runtime (no imports or live API calls into `web`).
- General company site, marketing CMS, or unrelated Didi Build products.
- Account billing, custom DNS, and multi-tenant admin UI (backlog; see [open questions](#open-questions)).

## Seams

Agents should extend behavior only through these interfaces, not ad hoc fetches or hardcoded hosts.

| Seam             | Responsibility                                                                        | Shape                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Card data**    | Load the card record and its **lead sinks** for the current request.                  | D1 repository: lookup context → typed card + validated **`lead_sinks`** rows; public lookup requires `cards.status = 'live'` and `accounts.status = 'active'` ([0010](../decisions/0010-card-data-d1-and-load-script.md), [0018](../decisions/0018-lead-sink.md)).              |
| **Accounts**     | Google identity, waitlist, and owner email.                                           | `accounts` + `sessions` in D1; owner inbox only on `accounts.email`; email sinks use `account_email` sentinel resolved at enqueue ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)).                                                                   |
| **App API**      | Editor auth and card CRUD.                                                            | JSON routes under `/api/app/*` and `/api/auth/*` on the app host only; client interface **`AppApi`** ([app-api-contract](./app-api-contract.md)).                                                                                                                               |
| **Lead sink**    | Deliver a lead to one destination (`kind` implementation).                            | **`LeadSink`**: record lead, append details, note delivery failure. **`email`** kind implemented in the follow-up consumer ([0023](../decisions/0023-owner-email-lead-sink-consumer.md)).                                                                                       |
| **Email sender** | Send fixed-template **visitor** follow-up and owner sink mail.                        | Gmail via follow-up consumer; non-prod redirects to `WE_MET_TEST_MAIL_TO`.                                                                                                                                                                                                      |
| **Base URL**     | One canonical origin for absolute links in email and metadata (`https://…`, no path). | Single config value per environment (see [environments](./environments.md)); never scatter hostnames in code.                                                                                                                                                                   |
| **Lookup**       | Resolve which card serves a request.                                                  | Order: **hostname** (custom domain later) → **path** (`/hi/<slug>`) → **live** card record. Reserved hostnames: [0014](../decisions/0014-reserved-hostnames-and-paths.md); reserved slugs at publish: [0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md). |

## Routes

| Route                  | Host            | Role                                                                                                                   |
| ---------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/`                    | Card + app      | Landing (card host); editor SPA root on `app.we-met.link`.                                                             |
| `/app`                 | Local + preview | Editor SPA mount (production uses `/` on app host).                                                                    |
| `/hi/<slug>`           | Card            | Public card page (live cards only).                                                                                    |
| `/hi/<slug>/photo.jpg` | Card            | Published headshot from R2 (`cards.photo_key`).                                                                        |
| `POST /api/exchange`   | Card            | Exchange submit (Turnstile, caps, dispatch sinks + mail).                                                              |
| `POST /api/details`    | Card            | Optional details (signed token).                                                                                       |
| `/api/auth/*`          | App (+ local)   | Google sign-in, preview test login, logout ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)). |
| `/api/app/*`           | App (+ local)   | Session, draft, publish, slug check, photo ([app-api-contract](./app-api-contract.md)).                                |

**Legacy mapping:** `didi.build/hi` → `/hi/didi`. **`didi.build` is not redirected.** Owner vCard is attached in the follow-up email after exchange only (no public `/hi/<slug>/contact.vcf`; [DIDI-641](https://linear.app/didi-build/issue/DIDI-641)). Slug rules: [0003](../decisions/0003-urls-and-lookup.md). Exchange API: [0008](../decisions/0008-api-routes-exchange-and-details.md).

## Theming

- **Variants:** closed set `green` and `mono`. The **brand variant** is chosen **server-side** from the card record; **light/dark** preference stays in the **browser**.
- **Colors:** only under `src/theme/tokens/` (e.g. `green.light.css`, `green.dark.css`; `mono.*` later). Components use CSS variables from those files, not raw hex or RGB. `npm run theme-colors` (in `npm run check`) rejects color literals outside that folder.
- **Per-card copy:** footer link and similar fields live on the card record, not in shared layout code.

## Pipeline flow

**Protections (exchange path):** Cloudflare Turnstile; honeypot (`website` field: non-empty is treated as a bot); per-IP rate limit (10 requests per 60 seconds via `WE_MET_EXCHANGE_RATE_LIMITER`); signed short-lived token for the details step (2 hour TTL); one recipient per submission for visitor email.

```mermaid
sequenceDiagram
  participant V as Visitor browser
  participant M as we-met Worker
  participant D as Lead sink dispatcher
  participant Q as Queues
  participant C as Consumers

  V->>M: POST /api/exchange (Turnstile + form)
  M->>M: Turnstile, honeypot, rate limit, app_settings caps
  M->>D: Dispatch enabled lead sinks
  D->>Q: One message per enabled sink
  M->>Q: Enqueue visitor_followup only when visitor_email_mode is direct (default owner_relay; [0027](../decisions/0027-owner-relay-visitor-follow-up.md))
  M-->>V: 200 + signed token (2h TTL)

  V->>M: POST /api/details (token + fields)
  M->>D: Dispatch append per enabled sink (once per lead)
  M-->>V: 200, or 409 details-already-sent on repeat submit

  Q->>C: Deliver jobs (per-message retries)
  C->>C: Email sink delivery; visitor follow-up only in direct mode
```

The **follow-up email consumer** (`we-met-followup-email-consumer` or `-nonprod`) sends **`email`** lead sink deliveries always, and **visitor** follow-up mail only when `app_settings.visitor_email_mode` is **`direct`** (default **`owner_relay`** skips send; [0027](../decisions/0027-owner-relay-visitor-follow-up.md)). **Lead sink delivery** uses **one queue message per sink** so retries and failures are independent ([0018](../decisions/0018-lead-sink.md)). Queue payloads carry a card field snapshot ([0016](../decisions/0016-queue-message-snapshot.md)). A **live** card must have exactly one enabled email sink ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)).

**Failure handling**

| Condition                                     | Behavior                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| Honeypot filled (`website` non-empty)         | Fake **200**, empty token; nothing dispatched or enqueued                |
| Turnstile fails                               | **403**                                                                  |
| Rate limited                                  | **429**                                                                  |
| Kill switch off or daily cap exceeded         | **503** `lead_email_unavailable`; no ledger, enqueue, or counter bump    |
| Visitor follow-up enqueue fails (direct mode) | **500**, generic message to client                                       |
| Lead sink dispatch enqueue fails (one sink)   | **Does not** fail other sinks or the HTTP response; that message retries |
| Lead sink delivery fails (consumer, one sink) | Retries for **that message only**; visitor email unaffected              |
| Visitor email fails after max attempts        | Acknowledged; sink handlers may note delivery failure                    |
| Card not live (suspended/retired or no sink)  | Public card **404**; exchange not reachable for that slug                |

Non-production mail is redirected on the consumer; see [0006](../decisions/0006-non-prod-safety.md) and [environments](./environments.md).

## Environments

See [environments.md](./environments.md) for queues, secrets names, previews, and deploy guards.

## Open questions

- **Multi-user (remaining):** admin UI, self-serve deletion, pricing, per-recipient cooldown ([DIDI-581](https://linear.app/didi-build/issue/DIDI-581), [DIDI-609](https://linear.app/didi-build/issue/DIDI-609)).
- **Custom domains:** `card.theirdomain.com` flow and DNS ([DIDI-580](https://linear.app/didi-build/issue/DIDI-580)).
- **Pricing and packaging** ([DIDI-579](https://linear.app/didi-build/issue/DIDI-579)).
- **`didi.build/hi` at cutover:** whether that URL redirects (decide before [DIDI-566](https://linear.app/didi-build/issue/DIDI-566)). Public `/hi/<slug>/contact.vcf` is closed (404); vCard is email-only ([DIDI-641](https://linear.app/didi-build/issue/DIDI-641)).
- **Photo orphan cleanup** and advanced abuse tooling ([DIDI-609](https://linear.app/didi-build/issue/DIDI-609)); ingestion is centralized ([0012](../decisions/0012-r2-images-single-ingestion.md)).
- **Details-step token:** must carry **per-sink** record references (e.g. Linear issue id) so append-details can target each sink; encoding is undecided.
