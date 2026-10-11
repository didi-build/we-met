# Card loading (D1)

Load personal card data from a **gitignored** JSON file into D1. Real card values never belong in git ([0010](../decisions/0010-card-data-d1-and-load-script.md)).

## Load file

- **Path:** `data/cards.local.json` (copy from `data/cards.example.json` and edit).
- **Git:** `git check-ignore -v data/cards.local.json` must show the file is ignored.

## Local D1 (developer machine)

Uses the `WE_MET_DB` binding from `wrangler.jsonc` with Wrangler’s **local** D1 persistence:

```bash
npm run cards:load
# or
npm run cards:load -- --file data/cards.local.json
```

## Remote non-prod D1 (`we-met-db-nonprod`)

Requires `WE_MET_D1_DATABASE_ID_NONPROD` (same variable as CI preview deploys). The script writes a temporary SQL file and runs `wrangler d1 execute` with a generated `wrangler.d1-nonprod.ci.jsonc` config (removed after the run).

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
