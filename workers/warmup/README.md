# we-met warmup cron Worker (DIDI-709, DIDI-710)

Separate Cloudflare Worker that sends low-volume seed mail on an hourly cron to warm up the `mail.we-met.link` sending lane. Deploying this Worker does **not** change the main `we-met` OpenNext Worker.

**Deploy and secrets are Diadem's steps** ([DIDI-711](https://linear.app/didi-build/issue/DIDI-711)); this README documents what to configure in Cloudflare.

## Wrangler config

From the repo root:

```bash
wrangler deploy --config workers/warmup/wrangler.jsonc
```

Before the first production deploy:

1. **KV**: Create a KV namespace for warmup state (`WARMUP_STATE`). Replace the placeholder `id` under `kv_namespaces` in `wrangler.jsonc` with the real namespace id (committing that id in git is fine).
2. **Queues**: Create queues `we-met-warmup-send-retry`, `we-met-warmup-send-dlq`, `we-met-warmup-email-events`, and `we-met-warmup-email-events-dlq` in the Cloudflare account (names must match `wrangler.jsonc`), or rename consistently in config and in the dashboard. The committed `wrangler.jsonc` already uses the final email-events queue names; production deploy guards reject zero UUID placeholder queue names if they appear in consumer `queue` or `dead_letter_queue` fields (same idea as the zero KV id).

## Secrets (names only; never commit values)

`WARMUP_SEEDS`, `WARMUP_FROM`, and `WARMUP_ALERT_TO` are the only sources of mailbox addresses for this Worker. None of those values belong in the repo; CI fails on any non-`@example.com` address under `workers/warmup/` (`npm run warmup-no-emails`).

| Secret            | Role                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WARMUP_SEEDS`    | Comma-separated seed recipients (warmup sends only).                                                                                                                      |
| `WARMUP_FROM`     | `From` on every outbound message, including pause alerts. Must be on `mail.we-met.link` (see in-code check in `lib/from-address.ts`; not duplicated in `wrangler.jsonc`). |
| `WARMUP_ALERT_TO` | Recipient for the one-shot email when auto-pause triggers.                                                                                                                |

```bash
wrangler secret put WARMUP_SEEDS --config workers/warmup/wrangler.jsonc
wrangler secret put WARMUP_FROM --config workers/warmup/wrangler.jsonc
wrangler secret put WARMUP_ALERT_TO --config workers/warmup/wrangler.jsonc
```

The `send_email` binding in `wrangler.jsonc` is unrestricted (no `allowed_sender_addresses`). Sender domain enforcement stays in code so `WARMUP_FROM` remains a secret.

If `WARMUP_SEEDS` or `WARMUP_FROM` is missing or empty, or `WARMUP_FROM` is not on `mail.we-met.link`, the Worker sends nothing. `WARMUP_ALERT_TO` is optional for day-to-day sending; without it, auto-pause still writes KV state but does not email anyone. When set, alerts are sent with `from` taken from `WARMUP_FROM`, same as seed mail.

## KV state (`WARMUP_STATE`)

| Key                    | Value                             | Meaning                                                                                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`              | `true` or anything else / missing | Kill switch. Sends run only when this key is exactly the string `true`. Missing means off.                                                                                                                                                                                              |
| `paused`               | JSON (or any non-empty string)    | Auto-pause latch: `{ "reason": "...", "at": "<ISO8601>" }`. Any non-empty value blocks sending. Delete this key to resume after fixing the issue. Legacy values may include `"alertSent": true`.                                                                                        |
| `paused_alert`         | JSON                              | One-shot alert tracking for the current pause episode: `{ "episode": "<sha256 hex of raw paused>", "sentAt": "<ISO8601>" }`. Harmless if stale after `paused` changes; resume still means deleting `paused`.                                                                            |
| `paused_alert_attempt` | JSON (TTL 6 h)                    | Rate-limit retries when alert send or `paused_alert` write fails: `{ "episode": "<sha256 hex of raw paused>", "at": "<ISO8601>" }`. Written before sending; expires after six hours (`WARMUP_ALERT_RETRY_COOLDOWN_SECONDS`). At most one alert attempt per episode per cooldown window. |

Hard send caps (fail closed if KV cannot be read): at most **15** successful sends per UTC calendar day and **220** per UTC calendar month, tracked in keys `cap:day:YYYY-MM-DD` and `cap:month:YYYY-MM`.

### Pause and resume

1. **Manual stop**: Set `enabled` to anything other than `true`, or delete the key. The next cron tick skips sending.
2. **Auto-pause**: On the first Workers `send_email` failure with code `E_RECIPIENT_SUPPRESSED` (hard bounce or spam complaint suppression) or `E_ACCOUNT_SUSPENDED` (account paused for reputation), the Worker writes `paused`, stops sending, and emails `WARMUP_ALERT_TO` once for that pause episode.
3. **Resume**: Fix the underlying issue, delete the `paused` key, set `enabled` to `true`, then confirm counters if you hit the daily or monthly cap.

Read state in the Cloudflare dashboard under **Workers KV** for the `WARMUP_STATE` namespace, or with Wrangler:

```bash
wrangler kv key get --namespace-id="<WARMUP_STATE_ID>" enabled
wrangler kv key get --namespace-id="<WARMUP_STATE_ID>" paused
```

### Bounce and complaint signal (DIDI-710, DIDI-720)

We do **not** poll the suppressions REST API from this Worker (no API token in the Worker). Pause triggers come from two paths:

**Synchronous (send binding)** from the [Email Sending Workers binding](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/):

- `E_RECIPIENT_SUPPRESSED`: recipient is on Cloudflare's suppression list (hard bounce or complaint).
- `E_ACCOUNT_SUSPENDED`: Cloudflare paused Email Sending for the account for reputation.

**Asynchronous (queue consumer, DIDI-720)** on `we-met-warmup-email-events`, fed by a Cloudflare Queues event subscription on sending domain `mail.we-met.link` for `cf.email.sending.message.bounced` and `cf.email.sending.message.complained` (provisioned in DIDI-721; names only here, no addresses in git).

| Event                                  | Seed recipient (`WARMUP_SEEDS`, case-insensitive)                           | Non-seed recipient                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Complaint                              | Pause warm-up only; one urgent alert per pause episode to `WARMUP_ALERT_TO` | No pause; one urgent alert per Email Sending `messageId` (KV dedupe, separate from pause episode keys) to `WARMUP_ALERT_TO` |
| Hard bounce (`bounce.type === "hard"`) | Same as complaint (`async_hard_bounce` reason)                              | Same as complaint                                                                                                           |
| Soft bounce                            | Log with redacted recipient only; no pause or alert                         | Log only                                                                                                                    |

Malformed bodies or `eventSchemaVersion !== 1` are logged and retried with bounded `max_retries` into `we-met-warmup-email-events-dlq` (never acked silently). Missing `WARMUP_STATE`, seeds, or `WARMUP_FROM` retries the batch so events are not dropped.

## Behavior

- Cron runs at minute 0 every hour (`0 * * * *`).
- Each tick rolls against a fixed probability targeting ~200 sends per month, subject to the KV kill switch, pause latch, and hard caps.
- Recipients are chosen at random from `WARMUP_SEEDS`; any other recipient is rejected and logged (addresses are never logged in full).
- Sends use the `EMAIL` (`send_email`) binding with `from` taken only from `WARMUP_FROM`. Transient failures enqueue a retry on `WARMUP_SEND_QUEUE` with explicit `max_retries` / `retry_delay` and a dead-letter queue; explicit DLQ publishes are guarded in code.
- The `queue()` handler routes `we-met-warmup-send-retry` to send retries and `we-met-warmup-email-events` to `processEmailEventsBatch`. Any other `batch.queue` is logged and its messages are acked without processing.

## Local dry-run

```bash
npm run worker:warmup-dry-run
```
