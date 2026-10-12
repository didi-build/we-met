# Architecture overview — We Met

## Purpose

**We Met** hosts digital exchange-contact cards: a visitor opens a card URL, shares their details, and both sides get email with the exchange. Step 1 is a single hosted card, behavior-identical to `didi.build/hi`, with clear seams so multi-user cards can follow without rewriting the core.

## Boundaries

**This repo owns**

- The Next.js app (UI, `/api/exchange` and `/api/details` handlers, card rendering).
- Cloudflare Workers deployment (OpenNext), `we-met-*` queues, consumers, D1, R2, and env-specific bindings.
- Card presentation, theming tokens, and the contact-exchange pipeline through to **visitor** follow-up email and **lead sink dispatch** ([0018](../decisions/0018-lead-sink.md)).

**Out of scope**

- The `didi-build/web` monolith at runtime (no imports or live API calls into `web`).
- General company site, marketing CMS, or unrelated Didi Build products.
- Account billing, custom DNS, and multi-tenant admin (backlog; see [open questions](#open-questions)).

## Seams

Agents should extend behavior only through these interfaces, not ad hoc fetches or hardcoded hosts.

| Seam             | Responsibility                                                                        | Shape                                                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Card data**    | Load the card record and its **lead sinks** for the current request.                  | Async adapter: lookup context → typed card + validated **`lead_sinks`** rows ([0010](../decisions/0010-card-data-d1-and-load-script.md), [0018](../decisions/0018-lead-sink.md)).                                                                |
| **Lead sink**    | Deliver a lead to one destination (`kind` implementation).                            | **`LeadSink`**: record lead, append details, note delivery failure. One implementation per **`kind`**; step 1 defines the interface and dispatcher only.                                                                                         |
| **Email sender** | Send the fixed-template **visitor** follow-up email (step 1).                         | Adapter that accepts rendered plain-text bodies and metadata; production uses the bound queue + consumer; local may noop or log. Owner notification moves to an email sink in step 2 ([DIDI-586](https://linear.app/didi-build/issue/DIDI-586)). |
| **Base URL**     | One canonical origin for absolute links in email and metadata (`https://…`, no path). | Single config value per environment (see [environments](./environments.md)); never scatter hostnames in code.                                                                                                                                    |
| **Lookup**       | Resolve which card serves a request.                                                  | Order: **hostname** (custom domain later) → **path** (`/hi/<slug>`) → **card record**. Reserved names: [0014](../decisions/0014-reserved-hostnames-and-paths.md).                                                                                |

## Routes

| Route                    | Role                                                     |
| ------------------------ | -------------------------------------------------------- |
| `/`                      | Placeholder landing page.                                |
| `/hi/<slug>`             | Public card page.                                        |
| `/hi/<slug>/contact.vcf` | vCard download (inline).                                 |
| `/hi/<slug>/photo.jpg`   | Card headshot from R2 (`photoKey` on the card record).   |
| `POST /api/exchange`     | Exchange submit (Turnstile, dispatch lead sinks + mail). |
| `POST /api/details`      | Optional details (signed token).                         |

**Step 1 legacy mapping (in this app):** `didi.build/hi` → `/hi/didi`; vCard equivalent. **`didi.build` is not redirected in step 1.** Slug rules and lookup: [0003](../decisions/0003-urls-and-lookup.md). API routes: [0008](../decisions/0008-api-routes-exchange-and-details.md).

## Theming

- **Variants:** closed set `green` and `mono`. The **brand variant** is chosen **server-side** from the card record; **light/dark** preference stays in the **browser**.
- **Colors:** only under `src/theme/tokens/` (e.g. `green.light.css`, `green.dark.css`; `mono.*` later). Components use CSS variables from those files, not raw hex or RGB. A `theme-colors` check (to be added) will reject color literals outside that folder as part of `npm run check`.
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
  M->>M: Turnstile, honeypot, rate limit
  M->>D: Dispatch enabled lead sinks
  D->>Q: One message per enabled sink
  M->>Q: Enqueue visitor_followup (independent)
  M-->>V: 200 + signed token (2h TTL)

  V->>M: POST /api/details (token + fields)
  M->>D: Dispatch append per enabled sink
  M-->>V: 200

  Q->>C: Deliver jobs (per-message retries)
  C->>C: Visitor follow-up email via Gmail (step 1); sink delivery per kind (step 2+)
```

In **step 1**, the **follow-up email consumer** (`we-met-followup-email-consumer` or `-nonprod`) sends only the **visitor** follow-up message. **Lead sink delivery** uses **one queue message per sink** so retries and failures are independent ([0018](../decisions/0018-lead-sink.md)). Queue payloads for email carry a card field snapshot ([0016](../decisions/0016-queue-message-snapshot.md)). **Step 1:** dispatcher and `lead_sinks` table only — **no sink implementations**; zero enabled sinks means no lead delivery messages.

**Failure handling**

| Condition                                     | Behavior                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| Honeypot filled (`website` non-empty)         | Fake **200**, empty token; nothing dispatched or enqueued                |
| Turnstile fails                               | **403**                                                                  |
| Rate limited                                  | **429**                                                                  |
| Visitor follow-up enqueue fails               | **500**, generic message to client                                       |
| Lead sink dispatch enqueue fails (one sink)   | **Does not** fail other sinks or the HTTP response; that message retries |
| Lead sink delivery fails (consumer, one sink) | Retries for **that message only**; visitor email unaffected              |
| Visitor email fails after max attempts        | Acknowledged; **note delivery failure** on sinks when implemented        |
| Zero enabled lead sinks                       | Exchange **200**; leads go nowhere until sinks are added (step 2+)       |

Non-production mail is redirected on the consumer; see [0006](../decisions/0006-non-prod-safety.md) and [environments](./environments.md).

## Environments

See [environments.md](./environments.md) for queues, secrets names, previews, and deploy guards.

## Open questions

- **Multi-user:** accounts, per-user cards, storage, and abuse limits ([DIDI-581](https://linear.app/didi-build/issue/DIDI-581)).
- **Custom domains:** `card.theirdomain.com` flow and DNS ([DIDI-580](https://linear.app/didi-build/issue/DIDI-580)).
- **Pricing and packaging** ([DIDI-579](https://linear.app/didi-build/issue/DIDI-579)).
- **`didi.build/hi` and `/hi/contact.vcf` at cutover:** whether those URLs redirect (decide before [DIDI-566](https://linear.app/didi-build/issue/DIDI-566)).
- **Square-crop upload UI** arrives with the future editor ([DIDI-581](https://linear.app/didi-build/issue/DIDI-581)); step 1 defines image ingestion only ([0012](../decisions/0012-r2-images-single-ingestion.md)).
- **Details-step token:** must carry **per-sink** record references (e.g. Linear issue id) so append-details can target each sink; encoding is undecided.
