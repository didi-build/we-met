# we-met warmup cron Worker (DIDI-709)

Separate Cloudflare Worker that sends low-volume seed mail on an hourly cron to warm up the `mail.we-met.link` sending lane. Deploying this Worker does **not** change the main `we-met` OpenNext Worker.

**Deploy and secrets are Diadem’s steps** ([DIDI-711](https://linear.app/didi-build/issue/DIDI-711)); this README documents what to configure in Cloudflare.

## Wrangler config

From the repo root:

```bash
wrangler deploy --config workers/warmup/wrangler.jsonc
```

Before the first production deploy:

1. **KV** — Create a KV namespace for warmup state (used in part 2). Replace the placeholder `id` under `kv_namespaces` → `WARMUP_STATE` in `wrangler.jsonc` with the real namespace id.
2. **Sender allowlist** — Set `send_email` → `allowed_sender_addresses` to the same address you store in `WARMUP_FROM` (must be on `mail.we-met.link`). The repo keeps `warmup-sender@example.com` as a CI-safe placeholder only.
3. **Queues** — Create queues `we-met-warmup-send-retry` and `we-met-warmup-send-dlq` in the Cloudflare account (names must match `wrangler.jsonc`), or rename both in config and in the dashboard consistently.

## Secrets (never commit values)

```bash
wrangler secret put WARMUP_SEEDS --config workers/warmup/wrangler.jsonc
# Comma-separated list of exactly four seed mailbox addresses.

wrangler secret put WARMUP_FROM --config workers/warmup/wrangler.jsonc
# From address on mail.we-met.link (must match allowed_sender_addresses).
```

If either secret is missing or empty, the Worker sends nothing.

## Behavior

- Cron runs at minute 0 every hour (`0 * * * *`).
- Each tick rolls against a fixed probability targeting ~200 sends per month.
- Recipients are chosen at random from `WARMUP_SEEDS`; any other recipient is rejected and logged (addresses are never logged in full).
- Sends use the `EMAIL` (`send_email`) binding. Transient failures enqueue a retry on `WARMUP_SEND_QUEUE` with explicit `max_retries` / `retry_delay` and a dead-letter queue; explicit DLQ publishes are guarded in code.

## Local dry-run

```bash
npm run worker:warmup-dry-run
```
