import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildMigrateNonprodCommentBody } from "./comment-body.mjs";
import { upsertMigrateNonprodComment } from "./gh-comment.mjs";

const ARTIFACT_DIR = "migrate-nonprod-artifact";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`migrate-nonprod apply: missing ${name}`);
    process.exit(1);
  }
  return value;
}

function writeSummary(text: string) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) {
    return;
  }
  appendFileSync(file, `${text}\n`);
}

function failWithComment(
  repository: string,
  prNumber: string,
  headSha: string,
  migrationHash: string,
  error: string,
  runUrl?: string,
) {
  const body = buildMigrateNonprodCommentBody({
    state: "failed",
    headSha,
    migrationHash,
    error,
    runUrl,
  });
  upsertMigrateNonprodComment({ repository, prNumber, body });
  console.error(error);
  process.exit(1);
}

function main() {
  const repository = requireEnv("GITHUB_REPOSITORY");
  const prNumber = requireEnv("PR_NUMBER");
  const runUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined;

  const manifestPath = join(ARTIFACT_DIR, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    headSha: string;
    migrationHash: string;
    files: string[];
  };

  writeSummary(
    `## Migrate non-prod D1 apply\n\n` +
      `Applying ${manifest.files.map((f) => `\`${f}\``).join(", ")} to **we-met-db-nonprod**.\n`,
  );

  const migrationsDir = join(ARTIFACT_DIR, "migrations");
  const prep = spawnSync(
    "node",
    [
      "scripts/prepare-wrangler-config.mjs",
      "--target",
      "d1-migrate-nonprod",
      "--output",
      "wrangler.d1-nonprod.ci.jsonc",
    ],
    { encoding: "utf8" },
  );
  if (prep.status !== 0) {
    failWithComment(
      repository,
      prNumber,
      manifest.headSha,
      manifest.migrationHash,
      prep.stderr || "prepare-wrangler-config failed",
      runUrl,
    );
  }

  const apply = spawnSync(
    "node",
    [
      "scripts/apply-migrations.mjs",
      "--remote",
      "we-met-db-nonprod",
      "--migrations-dir",
      migrationsDir,
      "--config",
      "wrangler.d1-nonprod.ci.jsonc",
    ],
    { encoding: "utf8", stdio: "pipe" },
  );

  if (apply.status !== 0) {
    const err = [apply.stdout, apply.stderr].filter(Boolean).join("\n");
    failWithComment(
      repository,
      prNumber,
      manifest.headSha,
      manifest.migrationHash,
      err || "wrangler d1 migrations apply failed",
      runUrl,
    );
  }

  writeSummary(`### Result\n\n\`\`\`\n${(apply.stdout || "OK").trim()}\n\`\`\`\n`);

  const appliedAt = new Date().toISOString();
  const body = buildMigrateNonprodCommentBody({
    state: "applied",
    headSha: manifest.headSha,
    migrationHash: manifest.migrationHash,
    files: manifest.files,
    appliedAt,
  });
  upsertMigrateNonprodComment({ repository, prNumber, body });
}

main();
