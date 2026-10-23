# Running SQL against D1

**Purpose:** Shared steps for the MVP operator runbooks that run ad-hoc SQL against **`WE_MET_DB`**. Schema names in those runbooks were checked against migrations **`0004_mvp_accounts_additive.sql`**, **`0005_cards_rebuild_mvp.sql`**, and **`0006_photo_upload_log.sql`** (and related tables in `0001` / `0002` where noted) by reading the migration files in this repo (**2026-10-16**).

**UNVERIFIED:** Commands below mirror [card-loading.md](./card-loading.md) and [deploy-setup.md](./deploy-setup.md); they were **not** executed against live non-prod or production D1 in this docs pass.

## Binding and database names

| Environment     | Wrangler `d1 execute` name | Cloudflare D1 database     | R2 bucket (photos)                           |
| --------------- | -------------------------- | -------------------------- | -------------------------------------------- |
| Non-prod remote | `WE_MET_DB`                | `we-met-db-nonprod`        | `we-met-assets-nonprod`                      |
| Production      | `WE_MET_DB`                | `we-met-db`                | `we-met-assets`                              |
| Local dev       | `WE_MET_DB`                | Wrangler local persistence | local / non-prod bucket per `wrangler.jsonc` |

The **binding** name passed to `wrangler d1 execute` is always **`WE_MET_DB`** (see `wrangler.jsonc` and `scripts/lib/build-wrangler-args.ts`).

## Auth

- **Maintainer laptop:** `npx wrangler login` (OAuth). Do **not** paste API tokens into runbooks or chat.
- **CI:** GitHub environment secrets (`CLOUDFLARE_API_TOKEN_*`) — see [deploy.md](./deploy.md) and [0017](../decisions/0017-cloudflare-api-credentials.md). Ad-hoc operator SQL is **not** run from CI.

## Non-prod remote (`we-met-db-nonprod`)

1. Export the non-prod database UUID from `npx wrangler d1 list` (after `wrangler login`) or the Cloudflare dashboard — not from GitHub (environment secrets cannot be read back):

```bash
export WE_MET_D1_DATABASE_ID_NONPROD='<nonprod-db-uuid>'
```

2. Generate the same gitignored config `cards:load` and `db:migrate:remote` use:

```bash
node scripts/prepare-wrangler-config.mjs \
  --target d1-migrate-nonprod \
  --output wrangler.d1-nonprod.ci.jsonc
```

3. **Single statement** (remote):

```bash
node "$(node -e "console.log(require('path').join(require('path').dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js'))")" \
  -c wrangler.d1-nonprod.ci.jsonc \
  d1 execute WE_MET_DB --remote \
  --command "SELECT id, status FROM accounts LIMIT 5;"
```

Shorter form if `npx wrangler` is on your PATH:

```bash
npx wrangler d1 execute WE_MET_DB --remote \
  -c wrangler.d1-nonprod.ci.jsonc \
  --command "SELECT id, status FROM accounts LIMIT 5;"
```

4. **SQL file** (remote):

```bash
npx wrangler d1 execute WE_MET_DB --remote \
  -c wrangler.d1-nonprod.ci.jsonc \
  --file ./operator.sql
```

(`scripts/load-cards.ts` uses the same `--file` pattern.)

5. Optional JSON output: add `--json` to `--command` runs (as in `load-cards.ts` account verification).

Wrangler may warn **Unexpected fields: migrations_dir** on the generated config; [card-loading.md](./card-loading.md) documents that as harmless for `d1 execute`.

## Production (`we-met-db`)

Production schema changes belong in the **Deploy production** workflow ([deploy.md](./deploy.md)). For **reviewed one-off operator SQL** only:

1. Export **`WE_MET_D1_DATABASE_ID_PRODUCTION`** from `npx wrangler d1 list` or the Cloudflare dashboard (not from GitHub secrets).
2. Generate production app config (same as deploy):

```bash
export WE_MET_D1_DATABASE_ID_PRODUCTION='<production-db-uuid>'
node scripts/prepare-wrangler-config.mjs \
  --target production \
  --output wrangler.ci.jsonc
```

3. Run with **`--remote`** and **`-c wrangler.ci.jsonc`**:

```bash
npx wrangler d1 execute WE_MET_DB --remote \
  -c wrangler.ci.jsonc \
  --command "SELECT key, value FROM app_settings WHERE key = 'lead_email_enabled';"
```

Requires **`production`** approval discipline and a second pair of eyes for destructive statements.

## Local D1

Uses default `wrangler.jsonc` without CI substitution:

```bash
npx wrangler d1 execute WE_MET_DB --local \
  --command "SELECT slug FROM cards;"
```

Reset local state: [card-loading.md](./card-loading.md#local-d1-developer-machine).

## Git Bash on Windows

- Prefer **double quotes** around the whole `--command "..."` string.
- Inside SQL, use **single quotes** for string literals (`'active'`).
- Escape embedded double quotes in SQL as `\"` if the shell requires it, or put the statement in a **`.sql` file** and use `--file` to avoid quoting bugs.
- Paths to `--file` should be forward slashes or quoted Windows paths (`"./operator.sql"`).

## Related operator runbooks

- [account-deletion](./account-deletion.md)
- [activating-an-account](./activating-an-account.md)
- [kill-switch-and-caps](./kill-switch-and-caps.md)
- [sign-out-everywhere](./sign-out-everywhere.md)
- [slug-fix](./slug-fix.md)
- [suspend-and-unsuspend](./suspend-and-unsuspend.md)
