# Documentation index

Project docs live here so humans and agents share the same map.

## Architecture

| Path                                                           | Purpose                                                               |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| [architecture/overview.md](./architecture/overview.md)         | Purpose, boundaries, seams, routes, theming, pipeline, open questions |
| [architecture/environments.md](./architecture/environments.md) | Local, preview, staging, production bindings and config names         |

## Decisions

| Path                                                                                       | Purpose                                 |
| ------------------------------------------------------------------------------------------ | --------------------------------------- |
| [decisions/README.md](./decisions/README.md)                                               | How to write ADRs                       |
| [decisions/0001-template-bootstrap.md](./decisions/0001-template-bootstrap.md)             | Launchpad bootstrap workflow            |
| [decisions/0002-hosting-workers-opennext.md](./decisions/0002-hosting-workers-opennext.md) | Workers, OpenNext, `we-met-*` resources |
| [decisions/0003-urls-and-lookup.md](./decisions/0003-urls-and-lookup.md)                   | `/p/<slug>`, lookup order, base URL     |
| [decisions/0004-card-data-and-branding.md](./decisions/0004-card-data-and-branding.md)     | Card record, variants, tokens           |
| [decisions/0005-keep-api-hi-route-names.md](./decisions/0005-keep-api-hi-route-names.md)   | `/api/hi/*` for step 1                  |
| [decisions/0006-non-prod-safety.md](./decisions/0006-non-prod-safety.md)                   | Non-prod queue, mail redirect, previews |
| [decisions/0007-production-deploy-manual.md](./decisions/0007-production-deploy-manual.md) | Manual production with approval         |

## Runbooks

| Path                                                 | Purpose                                 |
| ---------------------------------------------------- | --------------------------------------- |
| [runbooks/deploy.md](./runbooks/deploy.md)           | Preview, staging, and production deploy |
| [runbooks/rollback.md](./runbooks/rollback.md)       | Production rollback                     |
| [runbooks/test-leads.md](./runbooks/test-leads.md)   | Test leads in Linear and E2E mail check |
| [runbooks/bootstrap.md](./runbooks/bootstrap.md)     | Launchpad bootstrap workflow            |
| [runbooks/incident.md](./runbooks/incident.md)       | Incident notes                          |
| [runbooks/action-pins.md](./runbooks/action-pins.md) | Pinned GitHub Actions                   |

## Other

| Path                                                   | Purpose                                              |
| ------------------------------------------------------ | ---------------------------------------------------- |
| [new-project-checklist.md](./new-project-checklist.md) | GitHub settings after creating a repo from Launchpad |

Start with architecture and decisions before feature code. See [AGENTS.md](../AGENTS.md).
