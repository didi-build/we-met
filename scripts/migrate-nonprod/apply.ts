import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import {
  buildMigrateNonprodCommentBody,
  extractPreservedAppliedMarker,
} from "./comment-body.mjs";
import { upsertMigrateNonprodComment } from "./gh-comment.mjs";
import { hashFileContent } from "./hash.mjs";
import { resolveApplyHeadCheck, validateApplyPrHead } from "./apply-guard.mjs";
import { findMigrateNonprodBotCommentBody } from "./gh-api-comments.mjs";
import {
  formatApplyFailureCommentError,
  formatApplyResultSummaryBlock,
} from "./apply-output.mjs";
import { redactMigrationLog } from "./redact.mjs";
import { validatePrNumber } from "./validate.mjs";

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
  preservedAppliedMarker: string | null,
  runUrl?: string,
) {
  const body = buildMigrateNonprodCommentBody({
    state: "failed",
    headSha,
    migrationHash,
    error: formatApplyFailureCommentError(error),
    runUrl,
    preservedAppliedMarker,
  });
  upsertMigrateNonprodComment({ repository, prNumber, body });
  console.error(formatApplyFailureCommentError(error));
  process.exit(1);
}

function main() {
  const repository = requireEnv("GITHUB_REPOSITORY");
  const prValidated = validatePrNumber(requireEnv("PR_NUMBER"));
  if (!prValidated.ok) {
    console.error(`migrate-nonprod apply: ${prValidated.message}`);
    process.exit(1);
  }
  const prNumber = prValidated.prNumber;
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

  const existingBody = findMigrateNonprodBotCommentBody(repository, prNumber);
  const preservedAppliedMarker = existingBody
    ? extractPreservedAppliedMarker(existingBody)
    : null;

  const prJson = execFileSync("gh", ["api", `repos/${repository}/pulls/${prNumber}`], {
    encoding: "utf8",
    env: process.env,
  });
  const pr = JSON.parse(prJson) as { state: string; head: { sha: string } };
  const headCheck = validateApplyPrHead({
    prState: pr.state,
    prHeadSha: pr.head.sha,
    manifestHeadSha: manifest.headSha,
  });
  const headOutcome = resolveApplyHeadCheck(headCheck);
  if (!headOutcome.proceed) {
    writeSummary(`## Migrate non-prod D1 apply aborted\n\n${headOutcome.reason}\n`);
    console.error(headOutcome.reason);
    process.exit(headOutcome.exitCode);
  }

  writeSummary(
    `## Migrate non-prod D1 apply\n\n` +
      `Applying ${manifest.files.map((f) => `\`${f}\``).join(", ")} to **we-met-db-nonprod**.\n`,
  );

  const migrationsDir = join(ARTIFACT_DIR, "migrations");
  const apply = spawnSync(
    "node",
    [
      "scripts/apply-migrations.mjs",
      "--remote",
      "we-met-db-nonprod",
      "--migrations-dir",
      migrationsDir,
    ],
    { encoding: "utf8", stdio: "pipe" },
  );

  if (apply.status !== 0) {
    const err = redactMigrationLog(
      [apply.stdout, apply.stderr].filter(Boolean).join("\n") ||
        "wrangler d1 migrations apply failed",
    );
    failWithComment(
      repository,
      prNumber,
      manifest.headSha,
      manifest.migrationHash,
      err,
      preservedAppliedMarker,
      runUrl,
    );
  }

  const redactedOut = redactMigrationLog((apply.stdout || "OK").trim());
  writeSummary(`${formatApplyResultSummaryBlock(redactedOut)}\n`);

  const fileHashes: Record<string, string> = {};
  for (const path of manifest.files) {
    const content = readFileSync(join(ARTIFACT_DIR, path), "utf8");
    fileHashes[path] = hashFileContent(content);
  }

  const appliedAt = new Date().toISOString();
  const body = buildMigrateNonprodCommentBody({
    state: "applied",
    headSha: manifest.headSha,
    migrationHash: manifest.migrationHash,
    files: manifest.files,
    fileHashes,
    appliedAt,
  });
  upsertMigrateNonprodComment({ repository, prNumber, body });
}

main();
