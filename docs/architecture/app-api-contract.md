# App API contract (editor UI)

The card editor (`app.we-met.link`, or `/app` on local and previews) talks to the backend only through **`AppApi`** (`src/app-api/app-api.ts`). Production and non-prod use **`createHttpApi`** (`src/app-api/http-api.ts`).

**Host guard:** all routes below are served only when `isAppApiServingHost` is true ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)); otherwise the Worker returns **404**.

## HTTP routes (Worker)

| Route                                         | Method | `AppApi` / role                                  |
| --------------------------------------------- | ------ | ------------------------------------------------ |
| `/api/auth/google/start?mode=redirect\|popup` | GET    | `signIn` (redirect flow)                         |
| `/api/auth/google/callback`                   | GET    | `signIn` (OAuth callback)                        |
| `/api/auth/google/contacts/start`             | GET    | Contacts setup OAuth (session required)          |
| `/api/auth/google/contacts/callback`          | GET    | Contacts setup OAuth callback (People API sync)  |
| `/api/auth/preview-login`                     | POST   | Preview test sign-in only (`WE_MET_ENV=preview`) |
| `/api/auth/logout`                            | POST   | `signOut`                                        |
| `/api/app/session`                            | GET    | `getSession` (always **200**, body or `null`)    |
| `/api/app/card`                               | GET    | `getCard`                                        |
| `/api/app/card/draft`                         | PUT    | `saveDraft`                                      |
| `/api/app/slug-check?slug=`                   | GET    | `checkSlug`                                      |
| `/api/app/card/publish`                       | POST   | `publish`                                        |
| `/api/app/photo`                              | POST   | `uploadPhoto` (`Content-Type: image/jpeg`)       |
| `/api/app/photo`                              | GET    | Draft photo (`?v=<photo_key>`, owner only)       |
| `/api/app/photo`                              | DELETE | Remove draft photo (`photo_key` cleared)         |

Mutating routes require same-origin `Origin`, matching content type, and `Sec-Fetch-Site: same-origin` when present ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md) §6). Responses use `Cache-Control: no-store`.

## Session

| Method          | Returns              | Errors                                                   |
| --------------- | -------------------- | -------------------------------------------------------- |
| `getSession()`  | `AppSession \| null` | —                                                        |
| `signIn(mode?)` | `AppSession`         | `AppApiError`: `canceled`, `closed`, `failed`, `network` |
| `signOut()`     | `void`               | —                                                        |

`AppSession`: `{ email, name, allowed, contactsSetup }`. `allowed: false` means signed in but sign-up closed (**waitlisted**).

`contactsSetup` (server-computed visibility for the published dialog row):

- `{ visible: false }` — row hidden (ineligible, complete, declined this session, or admin block)
- `{ visible: true, variant: "default" }` — first-time **Continue with Google**
- `{ visible: true, variant: "reappear", newSenderAddress }` — new configured sender not yet saved on the account

Contacts OAuth success redirects to the app with `?contacts_setup=success`; decline or block uses `?contacts_setup=declined` and sets a short-lived session cookie so the row does not loop.

## Card data

| Method              | Returns                           | Errors                                                                                             |
| ------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| `getCard()`         | `{ draft, published, updatedAt }` | `unauthorized`, `forbidden` (waitlisted/suspended)                                                 |
| `saveDraft(card)`   | `{ updatedAt }`                   | `unauthorized`, `forbidden`, `rate-limited`, `invalid-fields`, `network`                           |
| `publish(card)`     | `{ url, contactsSetup }`          | `unauthorized`, `forbidden`, `rate-limited`, `invalid-fields`, publish validation codes, `network` |
| `checkSlug(slug)`   | `SlugCheckResult`                 | `network`                                                                                          |
| `uploadPhoto(blob)` | `{ url }`                         | `unauthorized`, `forbidden`, `rate-limited`, `invalid-photo`, `unavailable`, `network`             |

`EditorCard` matches `design/app/app.js` (slug, name, role, optional phone, photo URL, about[], services[], links, alternate).

- **Display name** (`name`): optional in the editor UI; shown on the public card. When empty at publish, the server resolves it to the signed-in Google name (publish pipeline; see DIDI-640).
- **Phone** (`phone`): optional; stored in draft JSON and, after publish, in `contact_json.phone` (empty string means none). Shared with people only after an exchange (follow-up email vCard), not on the public card page or in owner lead emails. Allowed characters: digits, spaces, and `+ - ( ) .`; trimmed length at most 20; at least 7 digits when non-empty. Control characters (including newlines) are rejected.

`published` is `null` until the first successful publish. The owner’s current published slug is always treated as available by `checkSlug`.

After first publish the slug is immutable (`slug-locked` on change attempts).

**Draft photos:** `saveDraft` does not read or write `card_drafts.photo_key`; only `POST` / `DELETE` `/api/app/photo` change it.

## Slug check

`checkSlug(slug)` → `SlugCheckResult`:

- `{ status: "available" }`
- `{ status: "taken" }`
- `{ status: "reserved" }`
- `{ status: "invalid", message }` (format rules; same copy as the editor)

Slug rules: 3–40 characters, lowercase letters, digits, single hyphens, no leading/trailing hyphen ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)).

## Photo

`uploadPhoto(blob)` → `{ url }` where `blob` is a **512×512 JPEG** (square crop, quality ~0.9). The server re-validates type, size, and squareness. Draft photos are served at `GET /api/app/photo?v=<key>` (owner only). `DELETE /api/app/photo` clears the draft `photo_key` without deleting published `cards.photo_key`.

Wire errors: **413** / **415** with empty body for oversize or wrong type; **422** `invalid-photo`; **503** `unavailable` when the Images binding or storage is unavailable.

## App API error codes (wire → `AppApiErrorCode`)

JSON shape: `{ "error": { "code": "...", "fields"?: { ... } } }`.

| HTTP | code             | When                                  |
| ---- | ---------------- | ------------------------------------- |
| 401  | `unauthorized`   | No or invalid session                 |
| 403  | `forbidden`      | Waitlisted/suspended or CSRF guard    |
| 409  | `slug-taken`     | Unique slug race                      |
| 409  | `slug-locked`    | Slug change after publish             |
| 422  | `name-missing`   | Publish without name                  |
| 422  | `slug-invalid`   | Publish slug format                   |
| 422  | `slug-reserved`  | Reserved slug                         |
| 422  | `invalid-fields` | Limit violations (`error.fields` map) |
| 422  | `invalid-photo`  | Photo validation failed               |
| 429  | `rate-limited`   | App or photo upload cap               |
| 503  | `unavailable`    | App route internal / dependency fault |

Client maps **5xx** and network failures to `network`.

## Public exchange API (not `AppApi`)

`POST /api/exchange` and `POST /api/details` ([0008](../decisions/0008-api-routes-exchange-and-details.md)) return **503** with body `{ "error": "lead_email_unavailable" }` when `lead_email_enabled` is off or daily caps would be exceeded — no ledger row, queue message, or `daily_send_counts` change ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md) phase 4).

`POST /api/exchange/vcard` (DIDI-743) returns the owner vCard after an exchange. The client sends the signed **details token** from `POST /api/exchange` in the **request body** only (`application/json` or `application/x-www-form-urlencoded` field `token`), never in the URL. Query-string tokens are not accepted. The token is verified with the same secret, version, and TTL as `POST /api/details` (`src/exchange/token.ts`). **400** `{ "error": "invalid_input" }` when the token is missing or malformed, or `Content-Type` is not JSON or form-encoded. **401** `{ "error": "invalid_token" }` for invalid, expired, or wrong-card tokens, and when the request `Host` is not a card-serving host (no owner data in the response). **404** `{ "error": "card_not_found" }` when the card is unpublished or missing. **429** `{ "error": "rate_limited" }` uses the exchange rate limiter with key `vcard:<client-ip>` (separate from `POST /api/exchange`). **GET** returns **405** with `Allow: POST`. Success is **200** with `Content-Type: text/vcard; charset=utf-8`, `Content-Disposition: attachment; filename="<name>.vcf"`, `Cache-Control: no-store`, and a vCard body matching the follow-up email attachment (`buildOwnerVCardAttachment`). This route is **not** gated on `lead_email_enabled` (no email is sent).

## UI expectations

- Autosave draft ~800ms after edits; `beforeunload` when a save is still pending.
- Drafts are server-side in `card_drafts` (no `localStorage` draft).
- Slug field is read-only after first publish; confirm dialog before first publish.
- Theme preference: `localStorage` key `wemet-app-theme` (`APP_THEME_STORAGE_KEY`).
