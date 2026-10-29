# 0025. We Met MVP: accounts, Google sign-in, sessions and the app backend

- **Status:** accepted
- **Date:** 2026-10-15
- **Ticket:** DIDI-612 (design), implemented by the tickets listed under Consequences
- **Updates:** [0003](./0003-urls-and-lookup.md) (slug rules), [0010](./0010-card-data-d1-and-load-script.md) (users table, write endpoints, `cards.email`), [0018](./0018-lead-sink.md) (zero sinks, email sink config), [0022](./0022-lead-delivery-ledger.md) and [0023](./0023-owner-email-lead-sink-consumer.md) (consumer reads `app_settings`), [0014](./0014-reserved-hostnames-and-paths.md) (slug reservations), [0013](./0013-future-app-host.md) (cookie details)

## Context

Step 1 shipped one hosted card with no users, no write endpoints and no accounts. The MVP (DIDI-608) lets a stranger sign in with Google, build a card in an editor, claim a slug, and receive leads by email. The editor UI (DIDI-611) is built against a stub behind one interface, `AppApi`. This ADR fixes the data model and backend that replace the stub.

Facts this design rests on (read from the repo on 2026-10-15):

- Migrations 0001 to 0003 are applied to production (production deploy run #16 succeeded on the commit that added 0003, including its "Apply production D1 migrations" step). New migrations start at 0004.
- `cards.slug` is `NOT NULL UNIQUE` and `cards.email` is `NOT NULL`. `hostnames` and `lead_sinks` reference `cards` with `ON DELETE CASCADE`. `lead_delivery_ledger` has no foreign keys.
- The public lookup is `SELECT ... FROM cards WHERE slug = ?` with no status filter. `slug.ts` allows 1 to 48 characters. No reserved slug list exists; `reserved.ts` only reserves the hostname labels `app`, `www` and `api`.
- The consumer takes the sink destination from the queue `sinkConfig` snapshot and reads D1 only for the ledger ([0022](./0022-lead-delivery-ledger.md), [0023](./0023-owner-email-lead-sink-consumer.md)).
- PR previews live on `https://pr-<N>-we-met-preview.<subdomain>.workers.dev` and share one non-prod D1 ([0019](./0019-pr-preview-github-action.md)). Preview runtime and build-time `WE_MET_BASE_URL` is **`https://we-met.didi.build`** ([DIDI-902](https://linear.app/didi-build/issue/DIDI-902)).
- Google rejects wildcard redirect URIs and requires exact matches.

## Decision

### 1. Sign-up and abuse controls

- **Open sign-up** for any Google account, controlled by the flag `signups_open`.
- **Launch controls:**
  - Kill switch: rows in `app_settings`, checked on exchange and details **before** any ledger row or enqueue, and again by the consumer before each send.
  - Daily caps on lead email only (owner and visitor emails), global and per card, stored in `app_settings`. The numbers are set at launch, under Google's current Workspace sending limit (UNVERIFIED, checked in the maintainer ticket).
  - The existing Turnstile, honeypot and rate limit on the card forms stay as they are.
  - Every user field is validated server-side with `CARD_FIELD_LIMITS`.
  - Suspend: a `status` column on accounts and cards, flipped by SQL in v1.
- **Daily counters are kept** (`daily_send_counts`, one row per day, card and email kind, no PII). They are product data for pricing.
- **Not in the MVP:** per-recipient cooldown, moderation, an admin UI, a request-access flow. They go to DIDI-609.

### 2. Accounts, cards and ownership

Tables added or changed (names are normative; exact columns are the implementer's call within these rules):

| Table               | Purpose                    | Key points                                                                                                                                                                                                                                                                                                 |
| ------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accounts`          | One row per Google account | `id` (own id), `google_sub` UNIQUE, `email` (lowercase), `name`, `status` in (`waitlisted`, `active`, `suspended`, `deleted`), `created_at`, `updated_at`, `last_login_at`. Email is not unique.                                                                                                           |
| `sessions`          | Server-side sessions       | SHA-256 hash of the opaque token as key, `account_id`, `created_at`, `expires_at` (30 days sliding), `absolute_expires_at` (90 days), `last_seen_at`.                                                                                                                                                      |
| `oauth_attempts`    | Single-use OAuth state     | State hash, nonce, PKCE verifier, `mode` (`redirect` or `popup`), `created_at`, `expires_at` (10 minutes).                                                                                                                                                                                                 |
| `card_drafts`       | The editor draft           | One row per account, the draft JSON, `photo_key`, `updated_at`.                                                                                                                                                                                                                                            |
| `app_settings`      | Flags and caps             | Key and value. Keys: `signups_open`, `lead_email_enabled`, `daily_cap_global`, `daily_cap_per_card`.                                                                                                                                                                                                       |
| `daily_send_counts` | Pricing data and caps      | Primary key (`day`, `card_id`, `kind` in `owner` or `visitor`), `count`. `card_id` is not a foreign key, so it outlives cards.                                                                                                                                                                             |
| `cards` (rebuilt)   | Published cards only       | The current columns minus `email`, plus `account_id NOT NULL` and `status` in (`live`, `suspended`, `retired`). Slug uniqueness and one card per account are **named unique indexes** (`CREATE UNIQUE INDEX`), not inline constraints, so a later migration can change them without another table rebuild. |
| `lead_sinks`        | Unchanged, plus an index   | A partial unique index `lead_sinks(card_id) WHERE kind = 'email'`.                                                                                                                                                                                                                                         |

Rules:

- One card per account in v1. No plan column; every MVP card is free (pricing is DIDI-579).
- Rows are created in this order: the account at first sign-in, the draft at first save, the `cards` row and its email sink together in one `db.batch` at first publish.
- **Migration shape:** one additive migration for the new tables, and a separate migration that rebuilds `cards`. The rebuild copies rows with a `SELECT` that cannot supply `account_id`, so it **fails loudly if `cards` holds any row**. Both production and non-prod must be emptied first (the maintainer's `didi` card is re-created by publishing, see section 7). This is a one-time, reviewed exception to the "never rewrite a table" habit. Children tables are empty at that point (production `lead_sinks` had 0 rows on 2026-10-15; `hostnames` is UNVERIFIED and the ticket checks it).

### 3. Google sign-in and sessions

- **Flow:** authorization code with PKCE (S256), `state` and `nonce`, run server-side by the Worker. Scopes are `openid email profile` only. Google's basic sign-in scopes are non-sensitive, so no scope review is expected (brand review status is UNVERIFIED).
- **Validation:** `iss`, `aud`, `exp`, `nonce` and `email_verified = true` are required. The signature is checked against Google's keys using WebCrypto (no new dependency unless justified).
- **Kept from Google:** `sub`, email and name. No tokens are stored. No avatar.
- **Two modes:** the sign-in screen uses a full-page redirect. The session-expired dialog uses a popup, so the in-memory form survives re-auth.
- **Binding:** the `oauth_attempts` row is tied to the browser by a short-lived `__Host-wm_oauth` cookie holding the state. It is single use.
- **Sessions:** opaque random token, only its hash is stored. `last_seen_at` updates at most once a day. Logout deletes the row. Suspend takes effect on the next request.
- **Cookie:** `__Host-wm_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`. Host-only on the app host ([0013](./0013-future-app-host.md)).
- **Redirect URI** is built from config, never from the request host ([0003](./0003-urls-and-lookup.md)): production uses `appBaseUrl(WE_MET_BASE_URL)`, local uses `WE_MET_APP_ORIGIN`, **staging** uses `WE_MET_BASE_URL` on the single card host ([0028](./0028-staging-we-met-didi-build.md)), previews use the request origin only when the host ends with `WE_MET_PREVIEW_HOST_SUFFIX`.
- **Non-prod:** real Google runs on `localhost` with remote non-prod bindings (a separate dev OAuth client). PR previews have no Google sign-in. They use `POST /api/auth/preview-login`: a long random secret (`WE_MET_PREVIEW_LOGIN_SECRET`, a preview base-config secret) signs in a fixed identity (`google_sub` `preview:test`, email from `WE_MET_PREVIEW_LOGIN_EMAIL`). The route fails closed when the secret is unset, exists only when `WE_MET_ENV=preview` (404 otherwise), compares in constant time, uses the auth rate limiter, and a CI guard plus a test fail if it is reachable under production or local config. Agents get the secret from their own secret store. Previews stay public (Cloudflare Access was considered and rejected because agents could not use previews).
- **Closed sign-ups:** when `signups_open` is off, a new Google account is created as `waitlisted` and gets a session with `allowed: false`. All card routes return 403 for non-active accounts. At sign-in a waitlisted account becomes `active` if `signups_open` is on. A suspended account fails sign-in (`failed`) in v1.

### 4. The email sink rule

- `accounts.email` is the **only** copy of the owner's address. `cards.email` and `contact_json.email` are removed.
- The card's one lead sink is `{ "to": "account_email" }` (kind `email`). The v1 validator accepts only that sentinel. A real address contains `@`, so custom addresses can be added later.
- The **app dispatcher resolves the sentinel at enqueue time** and puts a concrete `to` in the queue snapshot, so the consumer is unchanged ([0023](./0023-owner-email-lead-sink-consumer.md)). The same lookup supplies the visitor email's Reply-To and the vCard email at render time.
- The API has no address field. The sink is created by the server at first publish, in the same batch as the card.
- A card without exactly one enabled email sink is **not live**: the loader returns not found. This amends [0018](./0018-lead-sink.md), which allowed zero sinks.
- **Google address change:** at every sign-in, if the lowercase verified email differs from `accounts.email`, that one column is updated. Nothing else needs syncing. Stale until the next sign-in is accepted.
- The editor shows a note under "Leads go to": "Visitors who exchange contacts receive this address." Reply-To and the vCard include it in v1. Per-field vCard selection is later.

### 5. Go-live and slugs

- Drafts live in `card_drafts`; `cards` holds published cards only. The public lookup therefore never sees unpublished cards. It also filters on `cards.status = 'live'` and the account's status (a join).
- **Publish** validates the posted card (limits, https URLs, slug format, reserved list, uniqueness) and writes the draft and `cards` in one batch. The UNIQUE index is the authority on slug races; `checkSlug` is advisory.
- **Slugs are immutable after first publish.** There is no unlock, no change and no redirect in v1. The editor asks for a confirmation before first publish ("This link can't be changed later: we-met.link/hi/<slug>"). The maintainer can fix a slug by SQL for a support request. Quarantine and change rate limits are not needed and are dropped.
- **Slug format:** 3 to 40 characters, lowercase letters, numbers and single hyphens, no leading or trailing hyphen. One shared module (`slug.ts`) is used by the lookup, the API and the editor. This amends [0003](./0003-urls-and-lookup.md) (was 1 to 48).
- **Reserved slugs:** a new shared module, applied at claim time. It covers the design's list plus impersonation words (`we-met`, `wemet`, `official`, `staff`, `security`, `billing`, `pricing`, `terms`, `privacy`, `admin`, `support`, and similar). `didi` is not reserved. Nothing under `/hi/<slug>` can collide with a route, so the list is about impersonation, not routing.

### 6. The app API

Routes (all JSON; served on the production app host (`app.we-met.link`), the **staging** single host (`WE_MET_BASE_URL` when `WE_MET_ENV=staging`, see [0028](./0028-staging-we-met-didi-build.md)), PR preview hosts, and `localhost` / `127.0.0.1` when `WE_MET_ENV=local`; **404** on the production card host `we-met.link`):

| Route                                                  | `AppApi` method |
| ------------------------------------------------------ | --------------- |
| `GET /api/auth/google/start?mode=redirect\|popup`      | `signIn`        |
| `GET /api/auth/google/callback`                        | `signIn`        |
| `POST /api/auth/preview-login`                         | previews only   |
| `POST /api/auth/logout`                                | `signOut`       |
| `GET /api/app/session` (always 200, session or `null`) | `getSession`    |
| `GET /api/app/card`                                    | `getCard`       |
| `PUT /api/app/card/draft`                              | `saveDraft`     |
| `GET /api/app/slug-check?slug=`                        | `checkSlug`     |
| `POST /api/app/photo`, `GET /api/app/photo?v=<key>`    | `uploadPhoto`   |
| `POST /api/app/card/publish`                           | `publish`       |

- **SPA mount:** production serves it at `app.we-met.link/`. Staging serves the SPA under `/app` on the card host (landing stays on `/`). Local and previews serve the same SPA under `/app`, backed by the real API. The `/app-preview` stub route is removed.
- **Errors:** `{ "error": { "code": "...", "fields"?: ... } }`. 401 `unauthorized`, 403 `forbidden`, 409 `slug-taken` or `slug-locked`, 422 `name-missing` or `slug-invalid` or `slug-reserved` or `invalid-fields`, 413 and 415 for photos, 429 `rate-limited`. A 5xx or network failure becomes the client's `network`. New client codes: `slug-locked`, `forbidden`, `rate-limited`, `invalid-fields`.
- **CSRF and origin:** every POST, PUT and DELETE requires an `Origin` equal to the app origin (a missing or `null` origin is rejected), the exact content type (`application/json`, or `image/jpeg` for the photo route), and `Sec-Fetch-Site: same-origin` when the header is present. No CORS headers at all. `Cache-Control: no-store` on every API response. `SameSite=Lax` alone is not enough because `we-met.link` card pages are same-site with the app host.
- **Drafts:** last write wins in v1. `getCard` and `saveDraft` return `updatedAt` for a later merge flow.
- **Publish** takes the posted card (no race with an unflushed autosave).
- **Contract changes:** `signIn(mode)` (the redirect mode never resolves; after it, `getSession()` reads the cookie, and `canceled` or `failed` arrive as `?auth_error=`; `closed` means the popup was closed). `AppSession.allowed` is false for waitlisted accounts.
- **Rate limits:** two Workers rate-limit bindings: `auth` (10 per minute per IP) and `app` (60 per minute per account, key prefixed per route). Namespace ids differ per environment and the deploy guards are updated.

### 7. Photos, account deletion and moving the `didi` card

- **Photos:** the draft stores `photo_key`, the content hash from the single ingestion function ([0012](./0012-r2-images-single-ingestion.md); nothing else writes to R2). `uploadPhoto` returns `/api/app/photo?v=<key>`, an authenticated route that serves the current draft photo. Publishing copies the key to `cards.photo_key`; the published photo is served by the existing public route. The server validates type, size (before reading the body) and squareness regardless of the client. Orphan cleanup is DIDI-609.
- **Account deletion:** no self-serve button in v1 (privacy text says to email). A runbook retires instead of deleting: remove sessions, draft, sinks and photo objects; blank the card and set `cards.status = 'retired'` (the slug stays taken); anonymize the account (`google_sub` becomes `deleted:<id>`, email and name blanked, status `deleted`). The tombstone holds no personal data and keeps a historical account count and stable ids. **Whether a retired slug can ever be reused is deferred** to the future slug, handle and pricing decision. The ledger and daily counters are kept (no PII).
- **Moving `didi`:** with sign-ups closed, the migrations deploy, the maintainer signs in (a `waitlisted` account), flips it to `active` by SQL, fills the card in the editor, publishes `didi`, then opens sign-ups. `cards:load` refuses `--production`, and for non-prod and local it takes an account id or creates a fixture account.

## Reasons

- One owner address in one place removes drift between the account, the card and the sink.
- Drafts in their own table make "unpublished cards are invisible" a property of the schema, not of every query.
- D1 sessions give instant revocation (suspend, logout) for one indexed read per request, and most API calls already read D1.
- Immutable slugs remove quarantine, rate limits and the stranger-receives-old-QR-traffic problem for v1, and keep room for a paid feature later.
- A hardened test login on public previews keeps agents able to use previews, which a login wall would not.

## Consequences

- **Implementation** is three tickets under DIDI-615: maintainer setup, one agent implementation delivered as four ordered phases (one PR each), and post-ticket work (cutover, runbooks, docs).
- **Amendments to earlier ADRs:** 0003 (slug length), 0010 (a users table and write endpoints now exist; `cards.email` is gone), 0018 (zero sinks no longer live; email sink config is the sentinel), 0022 and 0023 (the consumer also reads `app_settings`), 0014 (slug reservations). `AGENTS.md` loses the "no public write endpoints in step 1" line.
- **Privileged changes:** migrations, wrangler bindings (two rate limiters, the app host route) and deploy guards.
- **New secrets and vars:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `WE_MET_PREVIEW_LOGIN_SECRET`, `WE_MET_PREVIEW_LOGIN_EMAIL`, `WE_MET_APP_ORIGIN` (local).
- **Security notes:** a stolen session cookie lets the thief edit and publish that one card; it cannot read leads (not stored), delete the account or change the email. Sign-out-everywhere is by SQL in v1.

## Future direction (not decided)

- A paid slug change, and multiple cards per account under `/hi/<handle>/<card>`. Holding the old handle when someone renames is part of that pricing decision (DIDI-579).
- Per-field vCard selection, real Google on every PR preview through an OAuth relay, a draft sync and merge flow, periodic email re-verification, a sign-out-everywhere button, self-serve deletion, a photo orphan cleanup job, an admin UI, a per-recipient cooldown, and a request-access flow. All tracked in DIDI-609.

## Phase 3 implementation notes (DIDI-617)

- **Variant:** every published MVP card uses `mono` only (no variant in the draft or editor).
- **Photo cap:** five uploads per hour per account, counted in D1 `photo_upload_log` when an upload reaches the Images binding (migration `0006`).
- **Image ingestion:** implemented in phase 3 (`src/images/ingest-card-photo.ts`); the only writer to `WE_MET_ASSETS`.

## Phase 4 implementation notes (DIDI-617)

- **Refusal at submit:** when `lead_email_enabled` is off or a daily cap would be exceeded, exchange and details return **503** with `lead_email_unavailable` and create no ledger row, queue message, or counter change. The response does not reveal which limit applied.
- **Fail-closed caps:** missing, non-numeric, or non-positive `daily_cap_global` or `daily_cap_per_card` rejects new submissions the same way. Missing `lead_email_enabled` still defaults to enabled (`src/app-settings/defaults.ts`).
- **Counters:** `daily_send_counts` increments for `owner` and/or `visitor` in the same D1 batch as the ledger insert (exchange reserves two sends; details append uses `changes() > 0` in-batch so duplicate append does not bump counts). UTC calendar day. **Verified locally (2026-10-16):** isolated D1 batch with conditional increment after `ON CONFLICT DO NOTHING` append insert.
- **Consumer:** when the switch is off, queued sink mail is marked ledger `failed` with `lead_email_paused`, nothing is sent, and the message is acked (no retry). Visitor follow-up messages are acked without send. Caps are not rechecked in the consumer.
- **Holding / retry when capped:** out of scope ([DIDI-609](https://linear.app/didi-build/issue/DIDI-609)).

## Assumptions and UNVERIFIED items

- **A1 (decided 2026-10-16):** when the kill switch is off or a daily cap is reached, **new** exchange and details submissions are rejected up front with **503** `lead_email_unavailable` (no ledger row, enqueue, or counter change). Messages already on the queue when the switch turns off are dropped by the consumer: sink deliveries mark the ledger row `failed` with `lead_email_paused`; visitor follow-up is acked without send. Holding and retrying capped submissions stays in [DIDI-609](https://linear.app/didi-build/issue/DIDI-609).
- D1 batch atomicity and whether the migration script wraps each migration in a transaction.
- That the photo and vCard routes share the lookup used by the page.
- That `hostnames` is empty in production.
- Whether Google asks for brand verification, and whether a `workers.dev` redirect URI is accepted (only relevant for the optional fixed-name preview).
- The Workers rate-limit binding periods (believed to be 10 or 60 seconds, so one binding gives one limit).
