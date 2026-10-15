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
- **Shape:** each card has `slug`, `variant` (`mono` | `green` only; `blue` exists in generated palette CSS for the UI but is **not** accepted in the load file until D1 schema supports it), optional `plan` (`free` | `pro`, default `free`), public fields (`name`, optional `role`, `photoKey`, section titles, `about[]`, `services[]`, public `links[]` with `type` `website` | `linkedin` | `github` | `instagram`, required `fallbackUrl` (https; becomes `links.bookingUrl` for visitor follow-up email), optional `fallbackLabel`), plus `email`, `contact` (vCard fields + `urls[]`), `pageCopy` (`pageTitle`, `emailFromName`, `headshotAlt`), and `copy` (thanks/exchange sheet/follow-up email strings). All public URLs must use `https://`. See `data/cards.example.json` and [0010](../decisions/0010-card-data-d1-and-load-script.md).
- **Optional `leadSinks` per card:** array of `{ "id", "kind", "enabled"?, "config" }`. Stable **`id`** (`^[a-z0-9][a-z0-9-]{0,62}$`, unique in the file, must start with **`{slug}-`** so ids cannot collide across cards). **`kind: "email"`** → `config: { "to": "<address>" }` only. Caps: **10** sinks and **5** email sinks per card ([0022](../decisions/0022-lead-delivery-ledger.md)). If **`leadSinks` is omitted** for a card, existing sink rows for that card are left unchanged. If **`leadSinks` is present** (even `[]`), the load reconciles: upsert listed ids and **delete** other sinks for that card.
- **Non-prod remote load:** when the file includes at least one **email** sink (enabled or disabled), every email sink `config.to` must equal **`WE_MET_TEST_MAIL_TO`** (same value as the non-prod consumer secret). Export that variable before `npm run cards:load -- --remote`. Loads with **no** email sinks do not require `WE_MET_TEST_MAIL_TO`.
- **Production:** do **not** load email sinks until the follow-up consumer delivers them (DIDI-586 PR4).

Example `leadSinks` on a card (use your test inbox for non-prod):

```json
"leadSinks": [
  {
    "id": "demo-owner-inbox",
    "kind": "email",
    "enabled": true,
    "config": { "to": "your-test-inbox@example.com" }
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

Requires `WE_MET_D1_DATABASE_ID_NONPROD` (same variable as CI preview deploys). The script writes a temporary SQL file and runs `wrangler d1 execute` with a generated `wrangler.d1-nonprod.ci.jsonc` config (removed after the run).

`prepare-wrangler-config.mjs` adds a top-level `migrations_dir` on that generated config (alongside `d1_databases[].migrations_dir`) so migration paths resolve from the repo root. Wrangler may print **Unexpected fields: migrations_dir** for the top-level key; that warning is harmless for `d1 execute` and can be ignored.

```bash
export WE_MET_D1_DATABASE_ID_NONPROD='<nonprod-db-uuid>'
npm run cards:load -- --remote --file data/cards.local.json
```

After a successful remote load, the script prints a read-back query result (`SELECT slug, updated_at FROM cards ORDER BY slug`) so you can confirm the remote database state.

## Remote production D1

**Destructive / high blast radius.** Requires `--remote --production`, `WE_MET_D1_DATABASE_ID_PRODUCTION`, and typing `production` at the prompt.

```bash
export WE_MET_D1_DATABASE_ID_PRODUCTION='<production-db-uuid>'
npm run cards:load -- --remote --production --file data/cards.local.json
```

Production loads are operator-only; there is no public API to create or update cards in step 1.

## Related

- Schema and migrations: [0010](../decisions/0010-card-data-d1-and-load-script.md), `npm run db:migrate` / `npm run db:migrate:remote`
- Deploy runbook: [deploy.md](./deploy.md)
