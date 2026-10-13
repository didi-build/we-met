import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { lintMigrationSql } from "../../src/migrations/expand-only-lint.ts";
import {
  buildMigrateNonprodCommentBody,
  extractPreservedAppliedMarker,
  parseAppliedMigrationHash,
  parseAppliedStateMarker,
} from "./comment-body.mjs";
import { hashFileContent, hashMigrationFiles } from "./hash.mjs";
import { upsertMigrateNonprodComment } from "./gh-comment.mjs";
import {
  checkAppliedFileImmutability,
  findDisallowedMigrationFileChanges,
} from "./plan-lib.mjs";
import { validatePrNumber } from "./validate.mjs";

const ARTIFACT_DIR = "migrate-nonprod-artifact";

type GhFile = {
  filename: string;
  status: string;
};

type GhContent = {
  content?: string;
  encoding?: string;
};

type GhTree = {
  tree: { path: string; type: string }[];
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`migrate-nonprod plan: missing ${name}`);
    process.exit(1);
  }
  return value;
}

function ghApiJson(path: string): unknown {
  const out = execFileSync("gh", ["api", path], {
    encoding: "utf8",
    env: process.env,
  });
  return JSON.parse(out);
}

function setOutput(name: string, value: string) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) {
    return;
  }
  appendFileSync(file, `${name}=${value}\n`);
}

function writeSummary(text: string) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) {
    return;
  }
  appendFileSync(file, `${text}\n`);
}

function decodeContent(entry: GhContent): string {
  if (!entry.content || entry.encoding !== "base64") {
    throw new Error("Unexpected contents API response");
  }
  return Buffer.from(entry.content.replace(/\n/g, ""), "base64").toString("utf8");
}

function fetchMigrationFile(repository: string, path: string, ref: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const data = ghApiJson(
    `repos/${repository}/contents/${encoded}?ref=${ref}`,
  ) as GhContent;
  return decodeContent(data);
}

function listPullFiles(repository: string, prNumber: string): GhFile[] {
  const pages: GhFile[] = [];
  let page = 1;
  while (true) {
    const batch = ghApiJson(
      `repos/${repository}/pulls/${prNumber}/files?per_page=100&page=${page}`,
    ) as GhFile[];
    pages.push(...batch);
    if (batch.length < 100) {
      break;
    }
    page += 1;
  }
  return pages;
}

function listMigrationPathsAtRef(repository: string, ref: string): string[] {
  const tree = ghApiJson(`repos/${repository}/git/trees/${ref}?recursive=1`) as GhTree;
  return tree.tree
    .filter(
      (entry) =>
        entry.type === "blob" &&
        entry.path.startsWith("migrations/") &&
        entry.path.endsWith(".sql"),
    )
    .map((entry) => entry.path)
    .sort();
}

function findBotCommentBody(repository: string, prNumber: string): string | null {
  const commentsRaw = execFileSync(
    "gh",
    ["api", "--paginate", `repos/${repository}/issues/${prNumber}/comments`],
    { encoding: "utf8", env: process.env },
  );
  const commentsJson = JSON.parse(commentsRaw) as {
    user?: { login?: string };
    body?: string;
  }[];
  const existingComment = commentsJson.find(
    (c) =>
      c.user?.login === "github-actions[bot]" &&
      typeof c.body === "string" &&
      c.body.includes("<!-- we-met-migrate-nonprod -->"),
  );
  return existingComment?.body ?? null;
}

function postPlanFailure(
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
    error,
    runUrl,
    preservedAppliedMarker,
  });
  upsertMigrateNonprodComment({ repository, prNumber, body });
  console.error(error);
  process.exit(1);
}

function main() {
  const repository = requireEnv("GITHUB_REPOSITORY");
  const prValidated = validatePrNumber(requireEnv("PR_NUMBER"));
  if (!prValidated.ok) {
    console.error(`migrate-nonprod plan: ${prValidated.message}`);
    process.exit(1);
  }
  const prNumber = prValidated.prNumber;
  const runUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined;

  const existingBody = findBotCommentBody(repository, prNumber);
  const preservedAppliedMarker = existingBody
    ? extractPreservedAppliedMarker(existingBody)
    : null;
  const appliedState = existingBody ? parseAppliedStateMarker(existingBody) : null;
  const placeholderHash = "0".repeat(64);

  const pr = ghApiJson(`repos/${repository}/pulls/${prNumber}`) as {
    state: string;
    head: { sha: string; repo: { full_name: string } };
    user: { login: string };
  };

  if (pr.state !== "open") {
    console.log(`PR #${prNumber} is not open (${pr.state}); skipping.`);
    setOutput("has_migrations", "false");
    setOutput("skip_apply", "true");
    return;
  }
  if (pr.head.repo.full_name !== repository) {
    postPlanFailure(
      repository,
      prNumber,
      pr.head.sha,
      placeholderHash,
      "Fork PRs cannot migrate shared non-prod D1.",
      preservedAppliedMarker,
      runUrl,
    );
  }
  if (pr.user.login === "dependabot[bot]") {
    console.log("Dependabot PRs are skipped.");
    setOutput("has_migrations", "false");
    setOutput("skip_apply", "true");
    return;
  }

  const headSha = pr.head.sha;
  const pullFiles = listPullFiles(repository, prNumber);

  const disallowed = findDisallowedMigrationFileChanges(pullFiles);
  if (disallowed.length > 0) {
    const names = disallowed.map((f) => `${f.filename} (${f.status})`).join(", ");
    postPlanFailure(
      repository,
      prNumber,
      headSha,
      placeholderHash,
      `Refusing changed migration files (only new files allowed): ${names}`,
      preservedAppliedMarker,
      runUrl,
    );
  }

  const migrationChanges = pullFiles.filter(
    (f) =>
      f.filename.startsWith("migrations/") &&
      f.filename.endsWith(".sql") &&
      f.status === "added",
  );

  if (migrationChanges.length === 0) {
    console.log("No added migration files in this PR.");
    setOutput("has_migrations", "false");
    setOutput("skip_apply", "true");
    return;
  }

  const migrationPaths = listMigrationPathsAtRef(repository, headSha);
  const allMigrationFiles = migrationPaths.map((path) => ({
    path,
    content: fetchMigrationFile(repository, path, headSha),
  }));
  const migrationHash = hashMigrationFiles(allMigrationFiles);

  const immutability = checkAppliedFileImmutability(appliedState, allMigrationFiles);
  if (!immutability.ok) {
    postPlanFailure(
      repository,
      prNumber,
      headSha,
      migrationHash,
      immutability.message,
      preservedAppliedMarker,
      runUrl,
    );
  }

  const filesToApply: { path: string; content: string }[] = [];
  for (const change of migrationChanges) {
    const content = fetchMigrationFile(repository, change.filename, headSha);
    const lint = lintMigrationSql(content);
    if (!lint.ok) {
      postPlanFailure(
        repository,
        prNumber,
        headSha,
        migrationHash,
        `${change.filename}: ${lint.message}`,
        preservedAppliedMarker,
        runUrl,
      );
    }
    filesToApply.push({ path: change.filename, content });
  }

  writeSummary(
    `## Migrate non-prod D1 plan\n\n` +
      `**PR:** #${prNumber}\n\n` +
      `**Head SHA:** \`${headSha}\`\n\n` +
      `**Migration hash:** \`${migrationHash}\`\n\n` +
      `### Files to apply\n\n` +
      filesToApply.map((f) => `- \`${f.path}\``).join("\n") +
      `\n\n### SQL\n\n` +
      filesToApply
        .map((f) => `#### \`${f.path}\`\n\n\`\`\`sql\n${f.content.trimEnd()}\n\`\`\`\n`)
        .join("\n"),
  );

  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeFileSync(
    join(ARTIFACT_DIR, "manifest.json"),
    JSON.stringify(
      { headSha, migrationHash, files: filesToApply.map((f) => f.path) },
      null,
      2,
    ),
    "utf8",
  );
  for (const file of filesToApply) {
    const dest = join(ARTIFACT_DIR, file.path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, file.content, "utf8");
  }

  setOutput("has_migrations", "true");
  setOutput("head_sha", headSha);
  setOutput("migration_hash", migrationHash);
  setOutput("apply_files", filesToApply.map((f) => f.path).join(","));

  const appliedHash = existingBody ? parseAppliedMigrationHash(existingBody) : null;

  if (appliedHash === migrationHash) {
    console.log("Migration hash matches last successful apply; skipping approval.");
    setOutput("skip_apply", "true");
    const body = buildMigrateNonprodCommentBody({
      state: "skipped",
      headSha,
      migrationHash,
      preservedAppliedMarker,
    });
    upsertMigrateNonprodComment({ repository, prNumber, body });
    return;
  }

  setOutput("skip_apply", "false");
  const body = buildMigrateNonprodCommentBody({
    state: "waiting",
    headSha,
    migrationHash,
    files: filesToApply.map((f) => f.path),
    runUrl,
    preservedAppliedMarker,
  });
  upsertMigrateNonprodComment({ repository, prNumber, body });
}

main();
