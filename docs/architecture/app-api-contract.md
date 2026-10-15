# App API contract (editor UI)

The card editor (`app.we-met.link`, preview at `/app-preview`) talks to the backend only through **`AppApi`** (`src/app-api/app-api.ts`). The preview route uses **`createStubApi`** until a real HTTP implementation ships.

## Session

| Method         | Returns              | Errors                                                   |
| -------------- | -------------------- | -------------------------------------------------------- |
| `getSession()` | `AppSession \| null` | —                                                        |
| `signIn()`     | `AppSession`         | `AppApiError`: `canceled`, `closed`, `failed`, `network` |
| `signOut()`    | `void`               | —                                                        |

`AppSession`: `{ email, name, allowed }`. `allowed: false` means signed in but sign-up closed.

## Card data

| Method            | Returns                           | Errors                                                                                   |
| ----------------- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| `getCard()`       | `{ draft, published, updatedAt }` | `unauthorized` when signed out                                                           |
| `saveDraft(card)` | `{ updatedAt }`                   | `unauthorized` (session expired), `network`                                              |
| `publish(card)`   | `{ url }`                         | `unauthorized`, `network`, `name-missing`, `slug-invalid`, `slug-taken`, `slug-reserved` |

`EditorCard` matches `design/app/app.js` (slug, name, role, photo URL, about[], services[], links, alternate).

`published` is `null` until the first successful publish. The owner’s current published slug is always treated as available by `checkSlug`.

## Slug check

`checkSlug(slug)` → `SlugCheckResult`:

- `{ status: "available" }`
- `{ status: "taken" }`
- `{ status: "reserved" }`
- `{ status: "invalid", message }` (format rules; same copy as the editor)

## Photo

`uploadPhoto(blob)` → `{ url }` where `blob` is a **512×512 JPEG** (square crop, quality ~0.9). Errors: `network`.

## Stub preview

`createStubApi(search)` reads `?stub=` flags (`login-error`, `closed`, `slug-taken`, `save-error`, `session-expired`, `upload-error`) for manual QA on `/app-preview`.

## UI expectations

- Autosave draft ~800ms after edits; `beforeunload` when a save is still pending.
- No `localStorage` draft in the React app (server stub holds state for the preview).
- Slug field: debounced remote check, lock after publish until unlock + confirm.
- Theme preference: `localStorage` key `wemet-app-theme` (`APP_THEME_STORAGE_KEY`).
