# Environments

Four environments share one codebase; bindings and secrets select behavior. **Non-prod never uses production queue, consumer, or Linear targets.**

|                    | **Local**                                                                          | **Preview**                       | **Staging**                                                | **Production**                           |
| ------------------ | ---------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| **Purpose**        | Developer machine                                                                  | Per-PR smoke on Cloudflare        | Pre-prod integration on `main`                             | Live card(s)                             |
| **Deploy**         | `npm run dev` (scaffold: [DIDI-571](https://linear.app/didi-build/issue/DIDI-571)) | Cloudflare **Preview** on each PR | Auto from `main` ([deploy runbook](../runbooks/deploy.md)) | Manual + GitHub Environment approval     |
| **Hostname**       | `localhost`                                                                        | `*.pages.dev` / preview URL       | Staging host (e.g. `we-met.didi.build`)                    | `we-met.link` (and later custom domains) |
| **Email queue**    | Mock / optional local binding                                                      | `we-met-email-queue-nonprod`      | Same non-prod queue                                        | `we-met-email-queue` (prod)              |
| **Queue consumer** | Not run or local stub                                                              | `we-met-email-consumer-nonprod`   | Same non-prod consumer                                     | `we-met-email-consumer` (prod)           |
| **Mail delivery**  | Redirect to test address                                                           | Redirect to test address          | Redirect to test address                                   | Real recipient addresses                 |
| **Linear**         | Non-prod team/project + test lead marking                                          | Same as staging                   | Non-prod target                                            | Production Linear target                 |
| **Turnstile**      | Test/site keys (Cloudflare dashboard)                                              | Test keys                         | Test keys                                                  | Production site + secret keys            |

## Non-prod mail safety

Preview and staging share **one** non-prod queue and consumer. The consumer **rewrites all outbound mail** to the configured test inbox (`WE_MET_TEST_MAIL_TO`). Jobs still create Linear issues, but those issues are marked as test leads ([test-leads runbook](../runbooks/test-leads.md)).

## Previews

Pull requests get **Cloudflare Previews** (not versioned `*.workers.dev` URLs). Each preview uses non-prod bindings only; deploy-time guards reject production resource names.

## Deploy-time guards

CI/deploy (see [DIDI-572](https://linear.app/didi-build/issue/DIDI-572)) must fail if:

- A non-prod build binds a production queue, consumer, or Linear credential.
- `WE_MET_ENV` (or equivalent) is `production` without the production GitHub Environment.

## Config and secret names

Values live in GitHub Environments, Cloudflare dashboard, or local `.env`. **Names only**—see `.env.example` after [DIDI-571](https://linear.app/didi-build/issue/DIDI-571).

| Name                   | Used in                                                                    |
| ---------------------- | -------------------------------------------------------------------------- |
| `WE_MET_ENV`           | All (`local` \| `preview` \| `staging` \| `production`)                    |
| `WE_MET_BASE_URL`      | All — canonical origin for links                                           |
| `TURNSTILE_SITE_KEY`   | Browser (public)                                                           |
| `TURNSTILE_SECRET_KEY` | Worker / API                                                               |
| `LINEAR_API_KEY`       | Consumer                                                                   |
| `LINEAR_TEAM_ID`       | Consumer (non-prod vs prod value per env)                                  |
| `WE_MET_TEST_MAIL_TO`  | Non-prod consumer mail redirect                                            |
| `EMAIL_QUEUE`          | Worker binding name → `we-met-email-queue` or `we-met-email-queue-nonprod` |
| `EMAIL_CONSUMER`       | Consumer worker binding to same queue family                               |

Additional card-data and provider keys are added in the scaffold ticket; they must follow the same per-environment split.

## Production deploy access

Deploys to **production** require the GitHub **`production` environment**, which uses required reviewers. Only people granted **approval** on that environment (repo admins configure the list) can run a production deploy workflow.
