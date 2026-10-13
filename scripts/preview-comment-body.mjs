#!/usr/bin/env node
/**
 * Build the GitHub PR comment body for Cloudflare Preview deploys.
 * Usage: node scripts/preview-comment-body.mjs <preview-url> [--migrations]
 */
const MARKER = "<!-- we-met-preview -->";

const MIGRATION_NOTICE = `

> **⚠️ This PR changes D1 migrations.** The preview will not work until they are applied to the shared non-prod database.
>
> **From GitHub (phone-friendly):** the [**Migrate non-prod D1**](https://github.com/didi-build/we-met/actions/workflows/migrate-nonprod.yml) workflow plans the SQL on this PR and waits for your approval on the \`migrate-nonprod\` environment. Watch for the separate status comment tagged \`we-met-migrate-nonprod\`.
>
> **From a terminal** (logged in with \`npx wrangler login\`):
>
> \`\`\`bash
> export WE_MET_D1_DATABASE_ID_NONPROD=<non-prod D1 database id>
> npm run db:migrate:remote
> \`\`\`
>
> This only touches \`we-met-db-nonprod\` (the script refuses any other database). Details: [deploy runbook, Preview section](https://github.com/didi-build/we-met/blob/main/docs/runbooks/deploy.md#preview-per-pull-request).`;

const args = process.argv.slice(2);
const migrations = args.includes("--migrations");
const previewUrl = args.find((arg) => arg !== "--migrations");

if (!previewUrl) {
  console.error("preview-comment-body: missing preview URL");
  process.exit(1);
}

let body = `${MARKER}
Cloudflare Preview: ${previewUrl}`;
if (migrations) {
  body += MIGRATION_NOTICE;
}

process.stdout.write(`${body}\n`);
