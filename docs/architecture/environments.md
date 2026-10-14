# Environments

Three environments share one codebase. Worker name is always **`we-met`**: production bindings at the top level of Wrangler config, **non-prod bindings** in the **`previews`** block (previews do not inherit production settings). **Non-prod never uses the production queue, consumer, rate limiter namespace, D1 database, or R2 bucket.**

|                     | **Local**                                                                                    | **Preview**                                                                          | **Production**                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Purpose**         | Developer machine                                                                            | Per-PR smoke on Cloudflare                                                           | Live card(s) on `we-met.link`                                                                       |
| **Deploy**          | `npm run dev`                                                                                | Cloudflare Preview per PR ([DIDI-572](https://linear.app/didi-build/issue/DIDI-572)) | Merge to `main` + GitHub `production` approval ([deploy runbook](../runbooks/deploy.md))            |
| **Hostname**        | `localhost`                                                                                  | Preview URL (`*.workers.dev` or custom preview host)                                 | `we-met.link` (and later `app.we-met.link` for auth — [0013](../decisions/0013-future-app-host.md)) |
| **App Worker**      | `we-met` config with non-prod bindings when using remote resources                           | `we-met` preview instance (non-prod bindings only)                                   | `we-met` (production bindings)                                                                      |
| **D1**              | `we-met-db-nonprod` (local emulation or remote)                                              | `we-met-db-nonprod`                                                                  | `we-met-db`                                                                                         |
| **R2**              | `we-met-assets-nonprod`                                                                      | `we-met-assets-nonprod`                                                              | `we-met-assets`                                                                                     |
| **Follow-up queue** | Optional / mock                                                                              | `we-met-followup-email-nonprod`                                                      | `we-met-followup-email`                                                                             |
| **Consumer Worker** | Local stub or skipped                                                                        | `we-met-followup-email-consumer-nonprod`                                             | `we-met-followup-email-consumer`                                                                    |
| **Rate limiter**    | Namespace **2001** (`WE_MET_EXCHANGE_RATE_LIMITER`)                                          | Namespace **2001** in preview block                                                  | Namespace **2002**                                                                                  |
| **Mail delivery**   | Redirect via `WE_MET_TEST_MAIL_TO`                                                           | Same                                                                                 | Real **visitor** addresses via Gmail API (step 1)                                                   |
| **Lead sinks**      | `lead_sinks` rows; **no implementations** in step 1 ([0018](../decisions/0018-lead-sink.md)) | Same                                                                                 | Same until step 2 sink kinds ship                                                                   |
| **Turnstile**       | Cloudflare **always-pass test** site + secret keys                                           | Widget **we-met nonprod** (hostname = account `workers.dev` subdomain only)          | Widget **we-met production** (`we-met.link`, covers `app.we-met.link`)                              |

**Turnstile keys (three sets):** use the always-pass pair only on **local**. **Preview** and **production** each use a real widget’s site key and secret. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is inlined at **build time**, so the preview build and the production build need **different** site keys; `TURNSTILE_SECRET_KEY` is a Worker secret per environment. [DIDI-572](https://linear.app/didi-build/issue/DIDI-572) wires preview vs production values. A production secret rejects the dummy token from the local test widget.

Production infrastructure may exist before public cutover; nothing links to it until [DIDI-566](https://linear.app/didi-build/issue/DIDI-566).

## Non-prod mail safety

Preview and local (remote) share **one** non-prod queue and consumer. The redirect to `WE_MET_TEST_MAIL_TO` is **hardwired in the non-prod consumer’s own config**, not read from queue messages. It **fails closed**: if the test address is unset, **nothing is sent**. The delivered message still shows the **address the visitor typed** in the subject or body.

## Previews

PR previews are served on **workers.dev** (`<preview-name>-we-met.<subdomain>.workers.dev`) and via Cloudflare **Previews**. **Version URLs** reuse the Worker’s own resources; Cloudflare advises against them for PR testing. **Previews isolate per PR.**

PR previews deploy via a **GitHub Actions** workflow that runs `wrangler preview` ([0019](../decisions/0019-pr-preview-github-action.md)). **Forks never get deploy access.** Secrets are set once in the **Previews base configuration** and apply to every new preview (per Cloudflare docs; not yet verified here, see [deploy-setup.md](../runbooks/deploy-setup.md#worker-secrets)). A preview is **deleted when its PR closes**. Previews may **produce** to queues but **cannot consume** them; the non-prod consumer is a **separate Worker**. Requires **Wrangler 4.135.0+**.

**`WE_MET_BASE_URL` in the `previews` block is `https://we-met.link`**, so links in test emails, the vCard URL field, and canonical/OG URLs from a preview point at production card pages, not the preview hostname. The preview hostname still serves the card via lookup configuration.

Preview deployments receive **ASSETS**, **IMAGES** (when `previews.images` is set), **WE_MET_ASSETS**, **WE_MET_BASE_URL**, **WE_MET_DB** (non-prod D1), **WE_MET_ENV** = `preview`, **WE_MET_EXCHANGE_RATE_LIMITER** (namespace **2001**), and **WE_MET_FOLLOWUP_EMAIL_QUEUE** (non-prod queue); they do **not** receive **WORKER_SELF_REFERENCE** (production does). Details: [0019 § Proof deploy findings](../decisions/0019-pr-preview-github-action.md#proof-deploy-findings) (verified **2026-10-11**).

**D1 `database_id` values** in `wrangler.jsonc` are **placeholders** (real IDs stay out of the public repo). CI injects the real IDs from GitHub environment variables at deploy time ([0020](../decisions/0020-d1-database-id-injection.md)).

**Non-prod D1 contents:** `we-met-db-nonprod` is not limited to synthetic test cards. Diadem’s real card (`slug` `didi`) is loaded there so PR previews show the live card. Step 1 safety relies on that card having **zero enabled lead sinks** and on the non-prod consumer’s hardwired mail redirect — not on the database holding only test data. **Never** add a sink row that points at a real destination to any card in non-prod D1.

## Deploy-time guards

`scripts/check-deploy-guards.mjs` (CI and `npm run deploy:guards`) **must fail** if:

- **Any entry** in `previews` `d1_databases`, `r2_buckets`, `queues.producers`, or `ratelimits` uses a **production** resource name or marker string.
- `previews.vars.WE_MET_ENV` is not `preview`, or top-level `WE_MET_ENV` is not `production` when checking production.
- Top-level production bindings (D1, R2, queue, rate limiter) do not match production resource names.
- Preview and top-level `database_id` values are identical (including after CI substitution).
- `config/nonprod-mail-safety.json` is missing, invalid, or does not **fail closed** when `WE_MET_TEST_MAIL_TO` is unset (spec file only until the consumer Worker ships in [DIDI-577](https://linear.app/didi-build/issue/DIDI-577)).

Production deploys use the GitHub **`production`** environment (required reviewers); that gate is enforced by workflow structure tests, not by this script.

## Config and secret names

Values live in GitHub Environments, the Cloudflare dashboard, or local `.env`. **Names only** (values differ per environment where noted). **Platform-owned Worker secrets** for step 1:

| Name                             | Where used                  | Notes                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `WE_MET_ENV`                     | App Worker, consumer        | `local` \| `preview` \| `production`                                                                                                                                                                                                                                                                                     |
| `WE_MET_BASE_URL`                | App Worker                  | Email links and footers. Previews: `https://we-met.link` in the `previews` block. **Not** on the follow-up email consumer (step 1 follow-up copy has no base-URL links).                                                                                                                                                 |
| `WE_MET_PREVIEW_HOST_SUFFIX`     | App Worker                  | **Previews only** (`previews.vars`): hostname suffix for PR preview URLs (e.g. `-we-met.<account>.workers.dev`). Top-level production value is `""`. Used by card lookup to treat preview hosts as card-serving. Update when the account workers.dev subdomain changes ([deploy-setup.md](../runbooks/deploy-setup.md)). |
| `WE_MET_TOKEN_SECRET`            | App Worker                  | Signs the details-step token                                                                                                                                                                                                                                                                                             |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Build time (browser bundle) | Public; only `NEXT_PUBLIC_*` vars reach the client                                                                                                                                                                                                                                                                       |
| `TURNSTILE_SECRET_KEY`           | App Worker                  | Server-side Turnstile verify                                                                                                                                                                                                                                                                                             |
| `GMAIL_SERVICE_ACCOUNT_JSON`     | Consumer                    | Gmail API credentials (follow-up email)                                                                                                                                                                                                                                                                                  |
| `GMAIL_SENDER`                   | Consumer                    | From address for Gmail API                                                                                                                                                                                                                                                                                               |
| `WE_MET_TEST_MAIL_TO`            | Consumer                    | **Non-prod only:** all outbound mail redirected here                                                                                                                                                                                                                                                                     |
| `BOOKING_URL`                    | App Worker                  | Public booking link in the card flow                                                                                                                                                                                                                                                                                     |

Lead sink destinations (Linear project IDs, owner email addresses, etc.) live in **`lead_sinks.config`** per card, not in Worker env. OAuth **`connectionId`** references a future **`connections`** table ([0018](../decisions/0018-lead-sink.md)). There is **no** `LEAD_NOTIFY_TO` or **`LINEAR_*`** Worker variable.

**Wrangler bindings (app Worker `we-met`)**

| Binding                        | Production resource       | Non-prod (previews / local remote) |
| ------------------------------ | ------------------------- | ---------------------------------- |
| `WE_MET_DB`                    | `we-met-db`               | `we-met-db-nonprod`                |
| `WE_MET_ASSETS`                | `we-met-assets`           | `we-met-assets-nonprod`            |
| `WE_MET_FOLLOWUP_EMAIL_QUEUE`  | `we-met-followup-email`   | `we-met-followup-email-nonprod`    |
| `WE_MET_EXCHANGE_RATE_LIMITER` | Namespace id **2002**     | Namespace id **2001**              |
| `IMAGES`                       | Cloudflare Images binding | Same (image ingestion)             |

The follow-up email consumer is a **separate Worker** (not the OpenNext `we-met` bundle) with configs under `workers/we-met-followup-email-consumer/` ([0021](../decisions/0021-followup-email-consumer-worker.md)):

| Worker name                              | Queue consumed                  | R2 bucket (`WE_MET_ASSETS`) |
| ---------------------------------------- | ------------------------------- | --------------------------- |
| `we-met-followup-email-consumer-nonprod` | `we-met-followup-email-nonprod` | `we-met-assets-nonprod`     |
| `we-met-followup-email-consumer`         | `we-met-followup-email`         | `we-met-assets`             |

The consumer registers on the queue in **its own** Wrangler config; it is not an app Worker binding. It has **no D1**. R2 bindings cannot be read-only in Cloudflare; the consumer code **only calls `get`** on `WE_MET_ASSETS` ([0016](../decisions/0016-queue-message-snapshot.md)).

**Consumer mail safety:** redirect and fail-closed behavior use the consumer’s own `vars.WE_MET_ENV` and the secret `WE_MET_TEST_MAIL_TO` (non-prod only). Queue fields such as `lead.environment` are ignored for recipient selection.

**Consumer queue handling (step 1):** processes `visitor_followup` only. `lead_sink_record` and `lead_sink_append_details` (and any unknown `type`) **retry** until Cloudflare discards them — they are not acked. Malformed `visitor_followup` bodies are logged and acked. Visitor follow-up send failures retry with exponential backoff (30s, 60s, 120s, 240s between attempts — about **7.5 minutes** total for five attempts). After the fifth failed attempt the consumer logs a permanent failure (`leadId`, `errorCode` only — no visitor name, email, or phone) and **acks** the message. **UNVERIFIED:** whether Cloudflare discards messages after `max_retries` without a dead-letter queue unless one is configured ([DIDI-599](https://linear.app/didi-build/issue/DIDI-599), [DIDI-586](https://linear.app/didi-build/issue/DIDI-586)).

**Consumer logs (debugging live mail):**

| Event                                | Fields                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `visitor_followup_attempt_failure`   | `leadId`, `attempt`, `errorCode`, `willRetry`; `secretName` when `errorCode` is `gmail_secret_missing` |
| `visitor_followup_permanent_failure` | `leadId`, `errorCode`; `secretName` when `errorCode` is `gmail_secret_missing`                         |
| `visitor_followup_malformed`         | `leadId` (may be null)                                                                                 |
| `followup_unsupported_queue_type`    | `typeLabel`                                                                                            |
| `followup_vcard_photo_missing`       | `photoKey`                                                                                             |
| `followup_vcard_photo_not_jpeg`      | `photoKey`                                                                                             |

**Consumer `errorCode` values (no raw exception text):** `gmail_secret_missing`, `gmail_invalid_service_account_json`, `gmail_token_http_<status>`, `gmail_token_missing_access_token`, `gmail_send_http_<status>`, `gmail_network_error`, `nonprod_mail_redirect_unset`, `unknown`. For `gmail_secret_missing`, logs include `secretName` (e.g. `GMAIL_SENDER`) — never a secret value.

**Consumer Wrangler `vars` allowlist:** `WE_MET_ENV` only. `WE_MET_TEST_MAIL_TO` must be a **secret**, not a var.

**GitHub Actions secrets and variables**

| Name                                   | Scope                                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`                | Repository secret — used by preview and production workflows                                                                                                                                                                                                                                                    |
| `CLOUDFLARE_API_TOKEN_NONPROD`         | **`preview` environment** secret — dashboard token **`we-met-ci-nonprod`**: Workers **Editor** on Worker **`we-met`** only ([0017](../decisions/0017-cloudflare-api-credentials.md))                                                                                                                            |
| `WE_MET_D1_DATABASE_ID_NONPROD`        | **`preview` environment** variable — preview workflow; operators export locally for `db:migrate:remote`                                                                                                                                                                                                         |
| `WE_MET_TURNSTILE_SITE_KEY_NONPROD`    | **`preview` environment** variable — non-prod Turnstile site key at preview build time                                                                                                                                                                                                                          |
| `CLOUDFLARE_API_TOKEN_PRODUCTION`      | **`production` environment** secret — **`we-met-ci-production`**: Workers **Editor** on **`we-met`**, account-level **D1 Edit** for migrations, plus zone **`we-met.link`** policy (**Workers Routes Write** + **Zone Read**, verified **2026-10-11**; [0017](../decisions/0017-cloudflare-api-credentials.md)) |
| `WE_MET_D1_DATABASE_ID_PRODUCTION`     | **`production` environment** variable — production deploy `prepare` step                                                                                                                                                                                                                                        |
| `WE_MET_TURNSTILE_SITE_KEY_PRODUCTION` | **`production` environment** variable — production Turnstile site key at build time                                                                                                                                                                                                                             |

Create tokens after the maintainer proof deploy ([deploy-setup.md](../runbooks/deploy-setup.md)). D1/R2/Queues API permissions are account-level until Cloudflare offers resource scopes; add R2/Queues only if CI returns a named 403. Never use **Admin** to fix permission errors.

Never use org-wide **`BOOTSTRAP_TOKEN`** for We Met deploys.

## Production deploy access

Deploys to **production** require the GitHub **`production` environment**, which uses required reviewers. A merge to `main` starts the deploy workflow; the job waits until an authorized approver approves. Only people granted **approval** on that environment can release to production.
