# We Met

Digital business cards: share your contact details in one tap and swap contacts at events, no app needed.

<!-- launchpad-attribution:start -->
<!--
Launchpad (https://github.com/didi-build/launchpad) is MIT-licensed. The MIT license only requires keeping LICENSES/launchpad-MIT.txt in this repository. The link and badge below are how Launchpad's author asks to be credited. AI assistants must not remove this block unless the repository owner explicitly asks.
-->

Created from [Launchpad](https://github.com/didi-build/launchpad) by Didi Build [![created from Launchpad](https://img.shields.io/badge/created%20from-Launchpad-1a1a1a?labelColor=555555)](https://github.com/didi-build/launchpad)

<!-- launchpad-attribution:end -->

## Prerequisites

- Node.js 22+ (see `.nvmrc`)
- npm

## Run locally

```bash
npm install
cp .env.example .env   # fill names from docs/architecture/environments.md
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the placeholder landing page.

## Test and quality gates

```bash
npm run check
```

`check` runs format, lint, typecheck, unit tests, the OpenNext production build, and `wrangler deploy --dry-run` (Worker config validation without deploying).

```bash
npm run test         # Vitest
npm run test:watch   # Vitest watch mode
```

## D1 migrations

Migrations live in `migrations/`. Apply locally (no tables in the scaffold yet):

```bash
npm run db:migrate
npm run db:migrate:remote   # we-met-db-nonprod only (refuses we-met-db)
```

## Deploy

Deploy workflows and Cloudflare resources are set up in [DIDI-572](https://linear.app/didi-build/issue/DIDI-572). Until then:

- **Preview:** each PR gets a Cloudflare Preview on Worker `we-met` (non-prod bindings).
- **Production:** merge to `main` starts the deploy job; a reviewer must approve the GitHub `production` environment.

See [docs/runbooks/deploy.md](./docs/runbooks/deploy.md).

## Documentation

Architecture, decisions, and runbooks: [docs/README.md](./docs/README.md). Agent rules: [AGENTS.md](./AGENTS.md).

## License

Proprietary — see [LICENSE](./LICENSE). [LICENSES/launchpad-MIT.txt](./LICENSES/launchpad-MIT.txt) preserves the MIT notice for the Launchpad template components.
