# Documentation index

Project docs live here so humans and agents share the same map.

## Architecture

| Path                                                           | Purpose                                                               |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| [architecture/overview.md](./architecture/overview.md)         | Purpose, boundaries, seams, routes, theming, pipeline, open questions |
| [architecture/environments.md](./architecture/environments.md) | Local, preview, staging, and production bindings and config names     |

## Decisions

| Path                                                                                                                 | Purpose                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [decisions/README.md](./decisions/README.md)                                                                         | How to write ADRs                                                                                               |
| [decisions/0001-template-bootstrap.md](./decisions/0001-template-bootstrap.md)                                       | Launchpad bootstrap workflow                                                                                    |
| [decisions/0002-hosting-workers-opennext.md](./decisions/0002-hosting-workers-opennext.md)                           | Workers, OpenNext, `we-met-*` resources                                                                         |
| [decisions/0003-urls-and-lookup.md](./decisions/0003-urls-and-lookup.md)                                             | `/hi/<slug>`, lookup order, base URL                                                                            |
| [decisions/0004-card-data-and-branding.md](./decisions/0004-card-data-and-branding.md)                               | Card record, D1, R2, variants, tokens                                                                           |
| [decisions/0005-keep-api-hi-route-names.md](./decisions/0005-keep-api-hi-route-names.md)                             | Superseded by 0008                                                                                              |
| [decisions/0006-non-prod-safety.md](./decisions/0006-non-prod-safety.md)                                             | Non-prod queue, mail redirect, previews                                                                         |
| [decisions/0007-production-deploy-manual.md](./decisions/0007-production-deploy-manual.md)                           | Production deploy with approval                                                                                 |
| [decisions/0008-api-routes-exchange-and-details.md](./decisions/0008-api-routes-exchange-and-details.md)             | `/api/exchange`, `/api/details`                                                                                 |
| [decisions/0009-environments-local-preview-production.md](./decisions/0009-environments-local-preview-production.md) | Superseded by 0028; was no staging                                                                              |
| [decisions/0010-card-data-d1-and-load-script.md](./decisions/0010-card-data-d1-and-load-script.md)                   | D1 schema; gitignored load file                                                                                 |
| [decisions/0011-d1-migrations.md](./decisions/0011-d1-migrations.md)                                                 | Migration policy                                                                                                |
| [decisions/0012-r2-images-single-ingestion.md](./decisions/0012-r2-images-single-ingestion.md)                       | R2 + single image function                                                                                      |
| [decisions/0013-future-app-host.md](./decisions/0013-future-app-host.md)                                             | `app.we-met.link` (future)                                                                                      |
| [decisions/0014-reserved-hostnames-and-paths.md](./decisions/0014-reserved-hostnames-and-paths.md)                   | Reserved hosts and paths                                                                                        |
| [decisions/0015-cache-friendly-not-cached-yet.md](./decisions/0015-cache-friendly-not-cached-yet.md)                 | Cache headers; caching backlog                                                                                  |
| [decisions/0016-queue-message-snapshot.md](./decisions/0016-queue-message-snapshot.md)                               | Queue payload; consumer without D1                                                                              |
| [decisions/0017-cloudflare-api-credentials.md](./decisions/0017-cloudflare-api-credentials.md)                       | Non-prod vs prod API tokens                                                                                     |
| [decisions/0018-lead-sink.md](./decisions/0018-lead-sink.md)                                                         | `lead_sinks` list; dispatch in step 1                                                                           |
| [decisions/0019-pr-preview-github-action.md](./decisions/0019-pr-preview-github-action.md)                           | PR previews via GitHub Actions                                                                                  |
| [decisions/0020-d1-database-id-injection.md](./decisions/0020-d1-database-id-injection.md)                           | D1 IDs from GitHub environment secrets at deploy                                                                |
| [decisions/0027-owner-relay-visitor-follow-up.md](./decisions/0027-owner-relay-visitor-follow-up.md)                 | Owner relay visitor follow-up                                                                                   |
| [decisions/0028-staging-we-met-didi-build.md](./decisions/0028-staging-we-met-didi-build.md)                         | Staging Worker `we-met-staging` on we-met.didi.build ([DIDI-873](https://linear.app/didi-build/issue/DIDI-873)) |

## Runbooks

| Path                                                           | Purpose                                            |
| -------------------------------------------------------------- | -------------------------------------------------- |
| [runbooks/deploy.md](./runbooks/deploy.md)                     | Preview, staging, and production deploy            |
| [runbooks/deploy-setup.md](./runbooks/deploy-setup.md)         | One-time Cloudflare/GitHub setup and proof deploy  |
| [runbooks/card-loading.md](./runbooks/card-loading.md)         | Load gitignored card JSON into D1 (local / remote) |
| [runbooks/rollback.md](./runbooks/rollback.md)                 | Production rollback                                |
| [runbooks/test-leads.md](./runbooks/test-leads.md)             | Test leads when Linear sink exists; E2E mail       |
| [runbooks/bootstrap.md](./runbooks/bootstrap.md)               | Launchpad bootstrap workflow                       |
| [runbooks/incident.md](./runbooks/incident.md)                 | Incident notes (outages)                           |
| [runbooks/privacy-breach.md](./runbooks/privacy-breach.md)     | PIPEDA breach response (RROSH, OPC, notification)  |
| [runbooks/account-deletion.md](./runbooks/account-deletion.md) | Privacy erasure (operator runbook)                 |
| [runbooks/action-pins.md](./runbooks/action-pins.md)           | Pinned GitHub Actions                              |

## Other

| Path                                                   | Purpose                                              |
| ------------------------------------------------------ | ---------------------------------------------------- |
| [new-project-checklist.md](./new-project-checklist.md) | GitHub settings after creating a repo from Launchpad |

Start with architecture and decisions before feature code. See [AGENTS.md](../AGENTS.md).
