# Card loading (D1)

Load personal card data from a **gitignored** JSON file into D1. Real card values never belong in git ([0010](../decisions/0010-card-data-d1-and-load-script.md)).

## Validate before load

```bash
npm run cards:load -- --validate-only --file data/cards.example.json
# or data/cards.local.json once you have real data
```

Prints `OK: <n> cards, <m> hostnames` and exits 0 when the JSON matches the schema (no D1, no Wrangler, no generated files).

## Load file

- **Path:** `data/cards.local.json` (copy from `data/cards.example.json` and edit).
- **Shape:** matches `design/card/card.html` `card-data` (see `data/cards.example.json`): `slug`, optional `variant` (`mono` only; omit for default), optional `plan` in the file for preview only (not stored in D1), `name`, optional `role`, `photoKey`, optional `about` (`title`, `paragraphs[]`), optional `services` (`title`, `items[]` with `title` / `description`), optional `links` object (`website`, `linkedin`, `github`, `instagram`), optional `alternate` (`url`, `label` — persisted as `bookingLinks.bookingUrl` for legacy rows only; visitor follow-up email copy is fixed in the app), plus top-level **`email`** (owner inbox; stored on `accounts.email`), `contact` (no `email` field — vCard uses the account email), `pageCopy`, and `copy` (exchange sheet strings only). Legacy `copy.followUpEmail` in JSON is accepted and ignored with a warning. All public URLs must use `https://`. See [0010](../decisions/0010-card-data-d1-and-load-script.md) and [0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md).
- **Optional `leadSinks` per card:** array of `{ "id", "kind", "enabled"?, "config" }`. Stable **`id`** (`^[a-z0-9][a-z0-9-]{0,62}$`, unique in the file, must start with **`{slug}-`** so ids cannot collide across cards). **`kind: "email"`** → `config: { "to": "account_email" }` only (resolved from the fixture account at enqueue). At most **one** email sink per card. If **`leadSinks` is omitted** for a card, existing sink rows for that card are left unchanged. If **`leadSinks` is present** (even `[]`), the load reconciles: upsert listed ids and **delete** other sinks for that card.
- **Accounts:** by default the loader creates a fixture account per card (`google_sub` `fixture:<slug>`). To attach the card in the file to an **existing** account, pass **`--account-id <uuid>`** (the account row must already exist; the loader does not insert or update it). Because of the one-card-per-account index (`cards_one_per_account`), **`--account-id` only works when the load file contains a single card**. Production loads are not supported — publish through the app ([0025](../decisions/0025-we-met-mvp-accounts-sign-in-and-app-backend.md)).
- **Non-prod remote load:** `account_email` sinks do not require `WE_MET_TEST_MAIL_TO`.

Example `leadSinks` on a card:

```json
"leadSinks": [
  {
    "id": "demo-owner-inbox",
    "kind": "email",
    "enabled": true,
    "config": { "to": "account_email" }
  }
]
```

- **Git:** `git check-ignore -v data/cards.local.json` must show the file is ignored.

## Local D1 (developer machine)

Uses the `WE_MET_DB` binding from `wrangler.jsonc` with Wrangler’s **local** D1 persistence:

If you previously migrated with an older `0001` schema (columns `footer_link_json` / `exchange_copy_json`), reset local D1 state:

```bash
rm -rf .wrangler/state
npm run db:migrate
```

Then load:

```bash
npm run cards:load -- --validate-only --file data/cards.example.json
npm run cards:load -- --file data/cards.example.json
```

### Local dev (`npm run dev`)

Committed `wrangler.jsonc` sets top-level `WE_MET_ENV` to `production`, so **`localhost` is not a card-serving host** unless you override it for local dev.

1. Copy [`.dev.vars.example`](../../.dev.vars.example) to **`.dev.vars`** (gitignored): `WE_MET_ENV=local`.
2. `npm run dev`
3. Smoke test (after loading `data/cards.example.json`):

```bash
curl -i http://localhost:3000/hi/didi    # expect 200 when didi card is loaded
curl -i http://localhost:3000/hi/unknown # expect 404
```

For your own data, use `data/cards.local.json` instead of the example file:

```bash
npm run cards:load
# or
npm run cards:load -- --file data/cards.local.json
```

## Remote non-prod D1 (`we-met-db-nonprod`)

Requires `WE_MET_D1_DATABASE_ID_NONPROD` (same UUID as the **`preview`** environment secret used by CI). The script writes a temporary SQL file and runs `wrangler d1 execute` with a generated `wrangler.d1-nonprod.ci.jsonc` config (removed after the run).

`prepare-wrangler-config.mjs` adds a top-level `migrations_dir` on that generated config (alongside `d1_databases[].migrations_dir`) so migration paths resolve from the repo root. Wrangler may print **Unexpected fields: migrations_dir** for the top-level key; that warning is harmless for `d1 execute` and can be ignored.

```bash
export WE_MET_D1_DATABASE_ID_NONPROD='<nonprod-db-uuid>'
npm run cards:load -- --remote --file data/cards.local.json
```

After a successful remote load, the script prints a read-back query result (`SELECT slug, updated_at FROM cards ORDER BY slug`) so you can confirm the remote database state.

## Remote production D1

`cards:load --production` is removed. Publish cards through the app editor on production.

## Related

- Schema and migrations: [0010](../decisions/0010-card-data-d1-and-load-script.md), `npm run db:migrate` / `npm run db:migrate:remote`
- Deploy runbook: [deploy.md](./deploy.md)
