# Environments

Four environments share one codebase; bindings and secrets select behavior. **Non-prod never uses the production queue, production consumer, or production Linear project.**

|                     | **Local**                                                                          | **Preview**                                                                   | **Staging**                                                | **Production**                              |
| ------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| **Purpose**         | Developer machine                                                                  | Per-PR smoke on Cloudflare                                                    | Pre-prod integration on `main`                             | Live card(s)                                |
| **Deploy**          | `npm run dev` (scaffold: [DIDI-571](https://linear.app/didi-build/issue/DIDI-571)) | Cloudflare **Preview** on each PR                                             | Auto from `main` ([deploy runbook](../runbooks/deploy.md)) | Manual + GitHub Environment approval        |
| **Hostname**        | `localhost`                                                                        | Preview URL                                                                   | `we-met.didi.build`                                        | `we-met.link` (and later custom domains)    |
| **Main Worker**     | `we-met` (dev)                                                                     | `we-met` (preview)                                                            | `we-met`                                                   | `we-met`                                    |
| **Follow-up queue** | Optional / mock                                                                    | `we-met-followup-email-nonprod`                                               | Same non-prod queue                                        | `we-met-followup-email`                     |
| **Consumer Worker** | Local stub or skipped                                                              | `we-met-followup-email-consumer-nonprod`                                      | Same non-prod consumer                                     | `we-met-followup-email-consumer`            |
| **Rate limiter**    | Non-prod namespace                                                                 | Non-prod namespace (`WE_MET_EXCHANGE_RATE_LIMITER` in preview Wrangler block) | Non-prod namespace                                         | Production namespace                        |
| **Mail delivery**   | Redirect via `WE_MET_TEST_MAIL_TO`                                                 | Redirect via `WE_MET_TEST_MAIL_TO`                                            | Redirect via `WE_MET_TEST_MAIL_TO` (typically owner inbox) | Real addresses (`LEAD_NOTIFY_TO` for owner) |
| **Linear**          | Shared **test** project (all non-prod)                                             | Same test project                                                             | Same test project                                          | Production project                          |
| **Turnstile**       | Cloudflare **always-pass test key pair** (site + secret)                           | Same test pair                                                                | **Real** keys for `we-met.didi.build`                      | Real production keys                        |

Use the test site key and test secret together on local and preview—a production secret rejects the dummy token from the test widget.

## Non-prod mail safety

Preview and staging share **one** non-prod queue and consumer. The consumer **rewrites outbound mail** to `WE_MET_TEST_MAIL_TO`. Linear issues still use the shared non-prod test project, with test lead markers ([test-leads runbook](../runbooks/test-leads.md)).

## Previews

Pull requests get **Cloudflare Previews** (not versioned `*.workers.dev` URLs). Each preview uses non-prod bindings only (queue, rate limiter namespace, Linear test project); deploy-time guards reject production resource names.

## Deploy-time guards

CI/deploy (see [DIDI-572](https://linear.app/didi-build/issue/DIDI-572)) must fail if:

- A non-prod build binds a production queue, consumer, rate limiter namespace, or production Linear credentials.
- `WE_MET_ENV` is `production` without the GitHub `production` environment.

## Config and secret names

Values live in GitHub Environments, the Cloudflare dashboard, or local `.env`. **Names only** (values differ per environment where noted).

| Name                             | Where used                  | Notes                                                     |
| -------------------------------- | --------------------------- | --------------------------------------------------------- |
| `WE_MET_ENV`                     | Main Worker, consumer       | `local` \| `preview` \| `staging` \| `production`         |
| `WE_MET_BASE_URL`                | Main Worker                 | Canonical origin for links                                |
| `WE_MET_TOKEN_SECRET`            | Main Worker                 | Signs the details-step token                              |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Build time (browser bundle) | Public; only `NEXT_PUBLIC_*` vars reach the client        |
| `TURNSTILE_SECRET_KEY`           | Main Worker                 | Server-side Turnstile verify                              |
| `LINEAR_API_KEY`                 | Main Worker, consumer       | Non-prod → shared test project; prod → production project |
| `LINEAR_TEAM_ID`                 | Main Worker, consumer       | Per-environment value                                     |
| `LINEAR_PROJECT_ID`              | Main Worker, consumer       | Non-prod → shared test project                            |
| `LINEAR_LEAD_LABEL_ID`           | Main Worker, consumer       | Includes `we-met-test-lead` on non-prod                   |
| `GMAIL_SERVICE_ACCOUNT_JSON`     | Consumer                    | Gmail API credentials                                     |
| `GMAIL_SENDER`                   | Consumer                    | From address for Gmail API                                |
| `LEAD_NOTIFY_TO`                 | Consumer                    | Owner inbox for lead notifications                        |
| `WE_MET_TEST_MAIL_TO`            | Consumer                    | **Non-prod only**—all outbound mail redirected here       |
| `BOOKING_URL`                    | Main Worker                 | Public booking link in the card flow                      |

**Wrangler bindings (main Worker `we-met`)**

| Binding                        | Purpose                                                                     |
| ------------------------------ | --------------------------------------------------------------------------- |
| `WE_MET_FOLLOWUP_EMAIL_QUEUE`  | Queue producer → `we-met-followup-email` or `we-met-followup-email-nonprod` |
| `WE_MET_EXCHANGE_RATE_LIMITER` | 10 requests per 60 seconds per IP                                           |

The consumer Worker registers on the queue in **its own** Wrangler config; it is not an app Worker binding.

**GitHub Actions secrets**

| Name                    | Scope                                                      |
| ----------------------- | ---------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Repository or `production` environment secret—not org-wide |
| `CLOUDFLARE_ACCOUNT_ID` | Repository or `production` environment secret—not org-wide |

## Production deploy access

Deploys to **production** require the GitHub **`production` environment**, which uses required reviewers. Only people granted **approval** on that environment (repo admins configure the list) can run a production deploy workflow.
