# App API contract (editor UI)

The card editor (`app.we-met.link`, or `/app` on local and previews) talks to the backend only through **`AppApi`** (`src/app-api/app-api.ts`). Production and non-prod use **`createHttpApi`** (`src/app-api/http-api.ts`).

## Session

| Method          | Returns              | Errors                                                   |
| --------------- | -------------------- | -------------------------------------------------------- |
| `getSession()`  | `AppSession \| null` | —                                                        |
| `signIn(mode?)` | `AppSession`         | `AppApiError`: `canceled`, `closed`, `failed`, `network` |
| `signOut()`     | `void`               | —                                                        |

`AppSession`: `{ email, name, allowed }`. `allowed: false` means signed in but sign-up closed (waitlisted).

## Card data

| Method              | Returns                           | Errors                                                                                             |
| ------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| `getCard()`         | `{ draft, published, updatedAt }` | `unauthorized`, `forbidden` (waitlisted/suspended)                                                 |
| `saveDraft(card)`   | `{ updatedAt }`                   | `unauthorized`, `forbidden`, `rate-limited`, `invalid-fields`, `network`                           |
| `publish(card)`     | `{ url }`                         | `unauthorized`, `forbidden`, `rate-limited`, `invalid-fields`, publish validation codes, `network` |
| `checkSlug(slug)`   | `SlugCheckResult`                 | `network`                                                                                          |
| `uploadPhoto(blob)` | `{ url }`                         | `unauthorized`, `forbidden`, `rate-limited`, `network` (413/415 for bad photos)                    |

`EditorCard` matches `design/app/app.js` (slug, name, role, photo URL, about[], services[], links, alternate).

`published` is `null` until the first successful publish. The owner’s current published slug is always treated as available by `checkSlug`.

After first publish the slug is immutable (`slug-locked` on change attempts).

## Slug check

`checkSlug(slug)` → `SlugCheckResult`:

- `{ status: "available" }`
- `{ status: "taken" }`
- `{ status: "reserved" }`
- `{ status: "invalid", message }` (format rules; same copy as the editor)

## Photo

`uploadPhoto(blob)` → `{ url }` where `blob` is a **512×512 JPEG** (square crop, quality ~0.9). The server re-validates type, size, and squareness. Draft photos are served at `GET /api/app/photo?v=<key>` (owner only).

## Error codes (wire → `AppApiErrorCode`)

| HTTP | code             | When                                  |
| ---- | ---------------- | ------------------------------------- |
| 401  | `unauthorized`   | No session                            |
| 403  | `forbidden`      | Waitlisted/suspended or CSRF guard    |
| 409  | `slug-taken`     | Unique slug race                      |
| 409  | `slug-locked`    | Slug change after publish             |
| 422  | `name-missing`   | Publish without name                  |
| 422  | `slug-invalid`   | Publish slug format                   |
| 422  | `slug-reserved`  | Reserved slug                         |
| 422  | `invalid-fields` | Limit violations (`error.fields` map) |
| 429  | `rate-limited`   | App or photo cap                      |

## UI expectations

- Autosave draft ~800ms after edits; `beforeunload` when a save is still pending.
- Drafts are server-side in `card_drafts` (no `localStorage` draft).
- Slug field is read-only after first publish; confirm dialog before first publish.
- Theme preference: `localStorage` key `wemet-app-theme` (`APP_THEME_STORAGE_KEY`).
