# Environments

Four environments share one codebase; Wrangler **environments** select the Worker name and bindings. **Non-prod never uses the production queue, production consumer, production rate limiter namespace, production Worker `we-met`, or production Linear project.**

|                     | **Local**                                                                          | **Preview**                                                                   | **Staging**                                                | **Production**                                      |
| ------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| **Purpose**         | Developer machine                                                                  | Per-PR smoke on Cloudflare                                                    | Pre-prod integration on `main`                             | Live card(s)                                        |
| **Deploy**          | `npm run dev` (scaffold: [DIDI-571](https://linear.app/didi-build/issue/DIDI-571)) | Preview under staging Worker                                                  | Auto from `main` ([deploy runbook](../runbooks/deploy.md)) | Manual + GitHub Environment approval                |
| **Hostname**        | `localhost`                                                                        | Preview URL                                                                   | `we-met.didi.build`                                        | `we-met.link` (when live)                           |
| **App Worker**      | Staging config locally                                                             | `we-met-staging` (preview instance)                                           | `we-met-staging`                                           | `we-met` (not deployed until `we-met.link` is live) |
| **Follow-up queue** | Optional / mock                                                                    | `we-met-followup-email-nonprod`                                               | Same non-prod queue                                        | `we-met-followup-email`                             |
| **Consumer Worker** | Local stub or skipped                                                              | `we-met-followup-email-consumer-nonprod`                                      | Same non-prod consumer                                     | `we-met-followup-email-consumer`                    |
| **Rate limiter**    | Non-prod namespace                                                                 | Non-prod namespace (`WE_MET_EXCHANGE_RATE_LIMITER` in preview Wrangler block) | Non-prod namespace                                         | Production namespace                                |
| **Mail delivery**   | Redirect via `WE_MET_TEST_MAIL_TO`                                                 | Same                                                                          | Same (typically owner inbox)                               | Real addresses (`LEAD_NOTIFY_TO` for owner)         |
| **Linear**          | Shared **test** project (all non-prod)                                             | Same test project                                                             | Same test project                                          | Production project                                  |
| **Turnstile**       | Cloudflare **always-pass test key pair** (site + secret)                           | Same test pair                                                                | **Real** keys for `we-met.didi.build`                      | Real production keys                                |

Use the test site key and test secret together on local and preview: a production secret rejects the dummy token from the test widget.

## Non-prod mail safety

Preview and staging share **one** non-prod queue and consumer. The redirect to `WE_MET_TEST_MAIL_TO` is **hardwired in the non-prod consumer’s own config**, not read from queue messages. It **fails closed**: if the test address is unset, **nothing is sent**. The delivered message still shows the **address the visitor typed** in the subject or body. Linear issues use the shared non-prod test project with test lead markers ([test-leads runbook](../runbooks/test-leads.md)).

## Previews

PR previews are served on **workers.dev** (`<preview-name>-<worker-name>.<subdomain>.workers.dev`) and via Cloudflare **Previews**. **Version URLs** reuse the Worker’s own resources; Cloudflare advises against them for PR testing. **Previews isolate per PR.**

Whether previews are triggered by Cloudflare Git integration or a GitHub Action is decided in [DIDI-572](https://linear.app/didi-build/issue/DIDI-572). **Forks never get deploy access.** Secrets are set once in the **Previews base configuration** and apply to every new preview. A preview is **deleted when its PR closes**. Previews may **produce** to queues but **cannot consume** them; the non-prod consumer is a **separate Worker**. Requires **Wrangler 4.135.0+**.

**UNVERIFIED:** whether an OpenNext build runs under `wrangler preview`. [DIDI-572](https://linear.app/didi-build/issue/DIDI-572) starts with a proof: one PR gets a preview URL, a form submission reaches the non-prod queue, and a test email arrives at the test address.

Previews are created under the **staging** Worker (`we-met-staging`; `previews` block in that Wrangler environment). Each preview uses non-prod bindings only.

## Deploy-time guards

CI/deploy ([DIDI-572](https://linear.app/didi-build/issue/DIDI-572)) **must fail** if:

- A non-prod build binds the **production** queue, consumer, or rate limiter namespace.
- A non-prod build targets the Worker named **`we-met`** (production Worker).
- A non-prod build points at any Linear **project** other than the shared test project (validate **`LINEAR_PROJECT_ID`**, not only the API key).
- The non-prod email **redirect is disabled** or misconfigured (consumer would send to real addresses).
- `WE_MET_ENV` is `production` without the GitHub **`production`** environment.

## Config and secret names

Values live in GitHub Environments, the Cloudflare dashboard, or local `.env`. **Names only** (values differ per environment where noted).

| Name                             | Where used                  | Notes                                                     |
| -------------------------------- | --------------------------- | --------------------------------------------------------- |
| `WE_MET_ENV`                     | App Worker, consumer        | `local` \| `preview` \| `staging` \| `production`         |
| `WE_MET_BASE_URL`                | App Worker, consumer        | Email links and footers are built from it                 |
| `WE_MET_TOKEN_SECRET`            | App Worker                  | Signs the details-step token                              |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Build time (browser bundle) | Public; only `NEXT_PUBLIC_*` vars reach the client        |
| `TURNSTILE_SECRET_KEY`           | App Worker                  | Server-side Turnstile verify                              |
| `LINEAR_API_KEY`                 | App Worker, consumer        | Non-prod → shared test project; prod → production project |
| `LINEAR_TEAM_ID`                 | App Worker, consumer        | Per-environment value                                     |
| `LINEAR_PROJECT_ID`              | App Worker, consumer        | Non-prod → shared test project                            |
| `LINEAR_LEAD_LABEL_ID`           | App Worker, consumer        | Includes `we-met-test-lead` on non-prod                   |
| `GMAIL_SERVICE_ACCOUNT_JSON`     | Consumer                    | Gmail API credentials                                     |
| `GMAIL_SENDER`                   | Consumer                    | From address for Gmail API                                |
| `LEAD_NOTIFY_TO`                 | Consumer                    | Owner inbox for lead notifications                        |
| `WE_MET_TEST_MAIL_TO`            | Consumer                    | **Non-prod only:** all outbound mail redirected here      |
| `BOOKING_URL`                    | App Worker                  | Public booking link in the card flow                      |

**Wrangler bindings (app Worker: `we-met-staging` or `we-met`)**

| Binding                        | Purpose                                                                     |
| ------------------------------ | --------------------------------------------------------------------------- |
| `WE_MET_FOLLOWUP_EMAIL_QUEUE`  | Queue producer → `we-met-followup-email` or `we-met-followup-email-nonprod` |
| `WE_MET_EXCHANGE_RATE_LIMITER` | 10 requests per 60 seconds per IP                                           |

The consumer Worker registers on the queue in **its own** Wrangler config; it is not an app Worker binding.

**GitHub Actions secrets**

| Name                    | Scope                                                        |
| ----------------------- | ------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | Repository or `production` environment secret (not org-wide) |
| `CLOUDFLARE_ACCOUNT_ID` | Repository or `production` environment secret (not org-wide) |

## Production deploy access

Deploys to **production** require the GitHub **`production` environment**, which uses required reviewers. Only people granted **approval** on that environment (repo admins configure the list) can run a production deploy workflow.
