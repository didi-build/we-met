# Architecture overview — We Met

## Purpose

**We Met** hosts digital exchange-contact cards: a visitor opens a card URL, shares their details, and both sides get email with the exchange. Step 1 is a single hosted card, behavior-identical to `didi.build/hi`, with clear seams so multi-user cards can follow without rewriting the core.

## Boundaries

**This repo owns**

- The Next.js app (UI, `/api/hi/*` handlers, card rendering).
- Cloudflare Workers deployment (OpenNext), `we-met-*` queues, consumers, and env-specific bindings.
- Card presentation, theming tokens, and the contact-exchange pipeline through to email and Linear.

**Out of scope**

- The `didi-build/web` monolith at runtime (no imports or live API calls into `web`).
- General company site, marketing CMS, or unrelated Didi Build products.
- Account billing, custom DNS, and multi-tenant admin (backlog; see [open questions](#open-questions)).

## Four seams

Agents should extend behavior only through these interfaces, not ad hoc fetches or hardcoded hosts.

| Seam             | Responsibility                                                                             | Shape                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Card data**    | Load the card record for the current request (contact fields, variant, footer link, slug). | Async function or adapter: input is lookup context; output is a typed card object. Step 1 uses a static in-repo record; later, storage-backed. |
| **Email sender** | Send the fixed-template exchange emails (visitor ↔ card owner).                            | Adapter that accepts rendered plain-text bodies and metadata; production uses the bound queue + consumer; local may noop or log.               |
| **Base URL**     | One canonical origin for absolute links in email and metadata (`https://…`, no path).      | Single config value per environment (see [environments](./environments.md)); never scatter hostnames in code.                                  |
| **Lookup**       | Resolve which card serves a request.                                                       | Order: **hostname** (custom domain later) → **path** (`/p/<slug>`) → **card record**. Returns a card id/slug or not found.                     |

## Routes

| Route                   | Role                                          |
| ----------------------- | --------------------------------------------- |
| `/`                     | Placeholder landing page.                     |
| `/p/<slug>`             | Public card page.                             |
| `/p/<slug>/contact.vcf` | vCard download (inline).                      |
| `POST /api/hi/exchange` | Exchange submit (Turnstile, Linear, enqueue). |
| `POST /api/hi/details`  | Optional details (signed token).              |

**Step 1 legacy mapping (in this app):** `/hi` → `/p/didi`; `/hi/contact.vcf` → `/p/didi/contact.vcf`; `/api/hi/*` paths unchanged. **`didi.build` is not redirected in step 1.** Slug rules and lookup: [0003](../decisions/0003-urls-and-lookup.md). API path names: [0005](../decisions/0005-keep-api-hi-route-names.md).

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
  participant L as Linear
  participant Q as we-met-followup-email queue
  participant C as we-met-followup-email-consumer

  V->>M: POST /api/hi/exchange (Turnstile + form)
  M->>M: Turnstile, honeypot, rate limit
  M->>L: Create lead
  M->>Q: Enqueue visitor_followup, owner_lead
  M-->>V: 200 + signed token (2h TTL)

  V->>M: POST /api/hi/details (token + fields)
  M->>L: Comment on lead (details)
  M->>Q: Enqueue owner_details (best effort)
  M-->>V: 200

  Q->>C: Deliver jobs
  C->>C: Gmail API: visitor vCard follow-up (one recipient); owner notifications
```

The **consumer** Worker (`we-met-followup-email-consumer` or `-nonprod`) registers on the queue in its own Wrangler config; it is not a binding on the main Worker.

**Failure handling**

| Condition                              | Behavior                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------- |
| Honeypot filled (`website` non-empty)  | Fake **200**, empty token; nothing created in Linear or the queue         |
| Turnstile fails                        | **403**                                                                   |
| Rate limited                           | **429**                                                                   |
| Linear create fails                    | **500**, generic message to client                                        |
| Enqueue fails after Linear lead exists | **500**; Linear comment that the follow-up email could not be queued      |
| Visitor email fails after 5 attempts   | Linear comment on the lead; message acknowledged                          |
| Owner email fails                      | Retry with backoff; acknowledge after max attempts; **no** Linear comment |
| Details enqueue fails                  | Logged only; **details** response is still **200**                        |

Non-production mail is redirected on the consumer; see [0006](../decisions/0006-non-prod-safety.md) and [environments](./environments.md).

## Environments

See [environments.md](./environments.md) for queues, secrets names, previews, and deploy guards.

## Open questions

- **Multi-user:** accounts, per-user cards, storage, and abuse limits ([DIDI-581](https://linear.app/didi-build/issue/DIDI-581)).
- **Custom domains:** `card.theirdomain.com` flow and DNS ([DIDI-580](https://linear.app/didi-build/issue/DIDI-580)).
- **Pricing and packaging** ([DIDI-579](https://linear.app/didi-build/issue/DIDI-579)).
- **`didi.build/hi` and `/hi/contact.vcf` at cutover:** whether those URLs redirect (decide before [DIDI-566](https://linear.app/didi-build/issue/DIDI-566)).
- **`we-met.didi.build` after go-live:** keep as staging, or redirect to `we-met.link` ([DIDI-564](https://linear.app/didi-build/issue/DIDI-564)).
