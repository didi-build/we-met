import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/preview-comment-body.mjs";
const PREVIEW_URL = "https://pr-42-we-met.example.workers.dev";

const MIGRATION_NOTICE = `

> **⚠️ This PR changes D1 migrations.** The preview will not work until they are applied to the shared non-prod database. Run this in a terminal where you are logged in (\`npx wrangler login\`):
>
> \`\`\`bash
> export WE_MET_D1_DATABASE_ID_NONPROD=<non-prod D1 database id>
> npm run db:migrate:remote
> \`\`\`
>
> This only touches \`we-met-db-nonprod\` (the script refuses any other database). Details: [deploy runbook, Preview section](https://github.com/didi-build/we-met/blob/main/docs/runbooks/deploy.md#preview-per-pull-request).`;

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function runBody(...args: string[]) {
  return spawnSync("node", [SCRIPT, ...args], { encoding: "utf8" });
}

describe("preview-comment-body (unit)", () => {
  it("without migrations: marker and preview URL only", () => {
    const result = runBody(PREVIEW_URL);
    expect(result.status).toBe(0);
    const body = result.stdout;
    expect(body.split("\n")[0]).toBe("<!-- we-met-preview -->");
    expect(body.trimEnd()).toBe(
      `<!-- we-met-preview -->\nCloudflare Preview: ${PREVIEW_URL}`,
    );
  });

  it("with migrations: marker first, URL, commands, no UUIDs; notice matches ticket text", () => {
    const result = runBody(PREVIEW_URL, "--migrations");
    expect(result.status).toBe(0);
    const body = result.stdout;
    expect(body.split("\n")[0]).toBe("<!-- we-met-preview -->");
    expect(body).toContain(`Cloudflare Preview: ${PREVIEW_URL}`);
    expect(body).toContain("export WE_MET_D1_DATABASE_ID_NONPROD=");
    expect(body).toContain("npm run db:migrate:remote");
    expect(body).not.toMatch(UUID_RE);
    expect(body.endsWith(MIGRATION_NOTICE + "\n")).toBe(true);
  });

  it("fails when preview URL is missing", () => {
    const result = runBody("--migrations");
    expect(result.status).toBe(1);
  });
});
