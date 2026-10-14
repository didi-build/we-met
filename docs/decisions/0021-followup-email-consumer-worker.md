# 0021. Follow-up email consumer: separate Worker, shared email module

- **Status:** accepted
- **Date:** 2026-10-14

## Context

The OpenNext app Worker `we-met` enqueues follow-up jobs but must not send mail inline. Step 1 needs a queue consumer that sends visitor follow-up email with a vCard attachment via Gmail, without D1 or duplicating card lookup ([0016](./0016-queue-message-snapshot.md), [DIDI-577](https://linear.app/didi-build/issue/DIDI-577)).

## Decision

- **Two consumer Workers** (one queue consumer each): `we-met-followup-email-consumer-nonprod` and `we-met-followup-email-consumer`, with Wrangler configs in `workers/we-met-followup-email-consumer/`.
- **Shared code** lives under `src/email/` (sender interface + Gmail implementation) and `src/followup-email-consumer/` (queue batch logic). The OpenNext bundle does not import the consumer entrypoint.
- **No D1** on the consumer. **R2:** bind `WE_MET_ASSETS`; enforce read-only in code (`get` only).
- **Non-prod deploy** is manual after merge; **production** consumer CI is deferred to [DIDI-599](https://linear.app/didi-build/issue/DIDI-599).

## Reasons

- Isolates Gmail credentials and mail blast radius from the web Worker.
- Keeps queue message snapshots as the single send-time source of truth.
- Allows dry-run and deploy guards on consumer configs without coupling to OpenNext build.

## Consequences

- `npm run check` dry-runs both consumer configs and `deploy:guards` validates them.
- Operators follow [deploy-setup.md](../runbooks/deploy-setup.md#non-prod-follow-up-email-consumer-manual-after-didi-577) for the first non-prod consumer deploy.
