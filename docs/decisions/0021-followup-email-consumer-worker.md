# 0021. Follow-up email consumer: separate Worker, shared email module

- **Status:** accepted
- **Date:** 2026-10-14
- **Updates:** 2026-10-15 (DIDI-599) — D1 binding for future ledger; production consumer CI

## Context

The OpenNext app Worker `we-met` enqueues follow-up jobs but must not send mail inline. Step 1 needs a queue consumer that sends visitor follow-up email with a vCard attachment via Cloudflare Email Service, without duplicating card lookup at send time ([0016](./0016-queue-message-snapshot.md), [DIDI-577](https://linear.app/didi-build/issue/DIDI-577)).

## Decision

- **Two consumer Workers** (one queue consumer each): `we-met-followup-email-consumer-nonprod` and `we-met-followup-email-consumer`, with Wrangler configs in `workers/we-met-followup-email-consumer/`.
- **Shared code** lives under `src/email/` (sender interface + Cloudflare Email Service implementation) and `src/followup-email-consumer/` (queue batch logic). The OpenNext bundle does not import the consumer entrypoint.
- **D1:** each consumer binds **`WE_MET_DB`** to the matching environment database (`we-met-db-nonprod` / `we-met-db`). Runtime D1 use is **ledger only** ([0022](./0022-lead-delivery-ledger.md), [0023](./0023-owner-email-lead-sink-consumer.md)). **R2:** bind `WE_MET_ASSETS`; enforce read-only in code (`get` only).
- **Non-prod deploy** is manual after merge; **production** consumer deploy runs in the approved **Deploy production** workflow ([DIDI-599](https://linear.app/didi-build/issue/DIDI-599)).

## Reasons

- Isolates mail credentials and send blast radius from the web Worker.
- Keeps queue message snapshots as the single send-time source of truth.
- Allows dry-run and deploy guards on consumer configs without coupling to OpenNext build.

## Consequences

- `npm run check` dry-runs both consumer configs and `deploy:guards` validates them.
- Operators follow [deploy-setup.md](../runbooks/deploy-setup.md#non-prod-follow-up-email-consumer-manual-after-didi-577) for the non-prod consumer; production consumer steps are in [deploy.md](../runbooks/deploy.md).
