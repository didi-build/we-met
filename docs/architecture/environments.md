# Environments

Three environments share one codebase. Worker name is always **`we-met`**: production bindings at the top level of Wrangler config, **non-prod bindings** in the **`previews`** block (previews do not inherit production settings). **Non-prod never uses the production queue, consumer, rate limiter namespace, D1 database, or R2 bucket.**

|                     | **Local**                                                          | **Preview**                                                                          | **Production**                                                                                      |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Purpose**         | Developer machine                                                  | Per-PR smoke on Cloudflare                                                           | Live card(s) on `we-met.link`                                                                       |
| **Deploy**          | `npm run dev`                                                      | Cloudflare Preview per PR ([DIDI-572](https://linear.app/didi-build/issue/DIDI-572)) | Merge to `main` + GitHub `production` approval ([deploy runbook](../runbooks/deploy.md))            |
| **Hostname**        | `localhost`                                                        | Preview URL (`*.workers.dev` or custom preview host)                                 | `we-met.link` (and later `app.we-met.link` for auth — [0013](../decisions/0013-future-app-host.md)) |
| **App Worker**      | `we-met` config with non-prod bindings when using remote resources | `we-met` preview instance (non-prod bindings only)                                   | `we-met` (production bindings)                                                                      |
| **D1**              | `we-met-db-nonprod` (local emulation or remote)                    | `we-met-db-nonprod`                                                                  | `we-met-db`                                                                                         |
| **R2**              | `we-met-assets-nonprod`                                            | `we-met-assets-nonprod`                                                              | `we-met-assets`                                                                                     |
| **Follow-up queue** | Optional / mock                                                    | `we-met-followup-email-nonprod`                                                      | `we-met-followup-email`                                                                             |
| **Consumer Worker** | Local stub or skipped                                              | `we-met-followup-email-consumer-nonprod`                                             | `we-met-followup-email-consumer`                                                                    |
| **Rate limiter**    | Non-prod namespace                                                 | Non-prod namespace (`WE_MET_EXCHANGE_RATE_LIMITER` in preview block)                 | Production namespace                                                                                |
| **Mail delivery**   | Redirect via `WE_MET_TEST_MAIL_TO`                                 | Same                                                                                 | Real addresses (`LEAD_NOTIFY_TO` for owner)                                                         |
| **Lead sink**       | No-op (`kind: "none"` on card)                                     | Same                                                                                 | Same until Linear sink before cutover ([0018](../decisions/0018-lead-sink.md))                      |
| **Turnstile**       | Cloudflare **always-pass test key pair** (site + secret)           | Same test pair                                                                       | Real keys for `we-met.link` (covers `app.we-met.link`)                                              |

Use the test site key and test secret together on local and preview: a production secret rejects the dummy token from the test widget.

Production infrastructure may exist before public cutover; nothing links to it until [DIDI-566](https://linear.app/didi-build/issue/DIDI-566).

## Non-prod mail safety

Preview and local (remote) share **one** non-prod queue and consumer. The redirect to `WE_MET_TEST_MAIL_TO` is **hardwired in the non-prod consumer’s own config**, not read from queue messages. It **fails closed**: if the test address is unset, **nothing is sent**. The delivered message still shows the **address the visitor typed** in the subject or body.

## Previews

PR previews are served on **workers.dev** (`<preview-name>-we-met.<subdomain>.workers.dev`) and via Cloudflare **Previews**. **Version URLs** reuse the Worker’s own resources; Cloudflare advises against them for PR testing. **Previews isolate per PR.**

Whether previews are triggered by Cloudflare Git integration or a GitHub Action is decided in [DIDI-572](https://linear.app/didi-build/issue/DIDI-572). **Forks never get deploy access.** Secrets are set once in the **Previews base configuration** and apply to every new preview. A preview is **deleted when its PR closes**. Previews may **produce** to queues but **cannot consume** them; the non-prod consumer is a **separate Worker**. Requires **Wrangler 4.135.0+**.

**`WE_MET_BASE_URL` in the `previews` block is `https://we-met.link`**, so links in test emails, the vCard URL field, and canonical/OG URLs from a preview point at production card pages, not the preview hostname. The preview hostname still serves the card via lookup configuration.

## Deploy-time guards

CI/deploy ([DIDI-572](https://linear.app/didi-build/issue/DIDI-572)) **must fail** if:

- **Any binding in the `previews` block** uses a **production** resource name (queue, consumer, rate limiter namespace, D1, or R2).
- A preview binds the **production** queue, consumer, rate limiter namespace, database, or bucket (including live preview binding checks against config).
- The non-prod email **redirect is disabled** or misconfigured (consumer would send to real addresses).
- `WE_MET_ENV` is `production` without the GitHub **`production`** environment.

When the **Linear lead sink** is enabled, add guards so non-prod never uses production Linear project credentials (validate **`LINEAR_PROJECT_ID`** for sink-backed cards).

## Config and secret names

Values live in GitHub Environments, the Cloudflare dashboard, or local `.env`. **Names only** (values differ per environment where noted).

| Name                             | Where used                  | Notes                                                                            |
| -------------------------------- | --------------------------- | -------------------------------------------------------------------------------- |
| `WE_MET_ENV`                     | App Worker, consumer        | `local` \| `preview` \| `production`                                             |
| `WE_MET_BASE_URL`                | App Worker, consumer        | Email links and footers. Previews: `https://we-met.link` in the `previews` block |
| `WE_MET_TOKEN_SECRET`            | App Worker                  | Signs the details-step token                                                     |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Build time (browser bundle) | Public; only `NEXT_PUBLIC_*` vars reach the client                               |
| `TURNSTILE_SECRET_KEY`           | App Worker                  | Server-side Turnstile verify                                                     |
| `GMAIL_SERVICE_ACCOUNT_JSON`     | Consumer                    | Gmail API credentials                                                            |
| `GMAIL_SENDER`                   | Consumer                    | From address for Gmail API                                                       |
| `LEAD_NOTIFY_TO`                 | Consumer                    | Owner inbox for lead notifications                                               |
| `WE_MET_TEST_MAIL_TO`            | Consumer                    | **Non-prod only:** all outbound mail redirected here                             |
| `BOOKING_URL`                    | App Worker                  | Public booking link in the card flow                                             |

**Linear sink implementation (later)** — not used in step 1 ([0018](../decisions/0018-lead-sink.md)). Worker secrets for the Linear `LeadSink` only:

| Name                   | Where used | Notes                                                |
| ---------------------- | ---------- | ---------------------------------------------------- |
| `LINEAR_API_KEY`       | App Worker | Linear API access for the sink implementation        |
| `LINEAR_TEAM_ID`       | App Worker | Per-environment value                                |
| `LINEAR_PROJECT_ID`    | App Worker | Non-prod → shared test project; prod → production    |
| `LINEAR_LEAD_LABEL_ID` | App Worker | Non-prod: `we-met-test-lead` label when sink enabled |

**Wrangler bindings (app Worker `we-met`)**

| Binding                        | Production resource               | Non-prod (previews / local remote) |
| ------------------------------ | --------------------------------- | ---------------------------------- |
| `WE_MET_DB`                    | `we-met-db`                       | `we-met-db-nonprod`                |
| `WE_MET_ASSETS`                | `we-met-assets`                   | `we-met-assets-nonprod`            |
| `WE_MET_FOLLOWUP_EMAIL_QUEUE`  | `we-met-followup-email`           | `we-met-followup-email-nonprod`    |
| `WE_MET_EXCHANGE_RATE_LIMITER` | Production rate limiter namespace | Non-prod rate limiter namespace    |
| `IMAGES`                       | Cloudflare Images binding         | Same (image ingestion)             |

The consumer Worker registers on the queue in **its own** Wrangler config; it is not an app Worker binding. Consumer binds read-only **`WE_MET_ASSETS`** only ([0016](../decisions/0016-queue-message-snapshot.md)).

**GitHub Actions secrets**

| Name                           | Scope                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`         | Repository secret — **non-prod** token for previews ([0017](../decisions/0017-cloudflare-api-credentials.md)) |
| `CLOUDFLARE_ACCOUNT_ID`        | Repository secret                                                                                             |
| `CLOUDFLARE_API_TOKEN` (prod)  | **`production` environment** secret only — production-scoped token                                            |
| `CLOUDFLARE_ACCOUNT_ID` (prod) | **`production` environment** secret (if distinct from repo)                                                   |

Never use org-wide **`BOOTSTRAP_TOKEN`** for We Met deploys.

## Production deploy access

Deploys to **production** require the GitHub **`production` environment**, which uses required reviewers. A merge to `main` starts the deploy workflow; the job waits until an authorized approver approves. Only people granted **approval** on that environment can release to production.
