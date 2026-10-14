import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pickBaselineShaFromDeployments } from "./baseline.mjs";
import { decideMigrationPlan, isMigrationSqlPath } from "./compare-migrations.mjs";
import { formatMigrationIntroduction } from "./attribution.mjs";
import { collectAdvisoryLintWarnings } from "./advisory-lint";
import {
  buildPlanSummaryMarkdown,
  buildWarningAnnotation,
  formatMigrationSection,
} from "./messages.mjs";
import { ghApiCall } from "../lib/privileged-gh-api.mjs";
import { parsePullRequestFilesApiStdout } from "../lib/privileged-pull-files-api.mjs";
import { resolvePlanExitCode } from "./exit-code.mjs";

type Deployment = { id: number; sha: string };
type GhTree = { tree: { path: string; type: string }[] };
type GhContent = { content?: string; encoding?: string };

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`deploy-production plan: missing ${name}`);
    process.exit(1);
  }
  return value;
}

function ghApi(path: string): string {
  return ghApiCall(execFileSync, process.env, [path]);
}

function ghApiPaginateSlurp(path: string): string {
  return ghApiCall(execFileSync, process.env, [path, "--paginate", "--slurp"]);
}

function parseJson(text: string): unknown {
  return JSON.parse(text.trim() || "null");
}

function writeSummary(text: string) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) {
    return;
  }
  appendFileSync(file, `${text}\n`);
}

function emitWorkflowWarning(message: string) {
  console.log(`::warning::${message}`);
}

function decodeContent(entry: GhContent): string {
  if (!entry.content || entry.encoding !== "base64") {
    throw new Error("Unexpected contents API response");
  }
  return Buffer.from(entry.content.replace(/\n/g, ""), "base64").toString("utf8");
}

function listProductionDeployments(repository: string): Deployment[] {
  const stdout = ghApiPaginateSlurp(
    `repos/${repository}/deployments?environment=production&per_page=100`,
  );
  const parsed = parseJson(stdout);
  /** @type {Deployment[]} */
  const deployments = [];
  const pages = Array.isArray(parsed)
    ? parsed.every((item) => Array.isArray(item))
      ? parsed
      : [parsed]
    : [];
  for (const page of pages) {
    if (!Array.isArray(page)) {
      continue;
    }
    for (const row of page) {
      if (
        row &&
        typeof row === "object" &&
        typeof row.id === "number" &&
        typeof row.sha === "string"
      ) {
        deployments.push({ id: row.id, sha: row.sha });
      }
    }
  }
  return deployments;
}

function latestDeploymentStatus(
  repository: string,
  deploymentId: number,
): string | null {
  const stdout = ghApi(
    `repos/${repository}/deployments/${deploymentId}/statuses?per_page=1`,
  );
  const statuses = parseJson(stdout);
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return null;
  }
  const first = statuses[0];
  if (first && typeof first === "object" && typeof first.state === "string") {
    return first.state;
  }
  return null;
}

function listMigrationPathsAtRef(repository: string, ref: string): string[] {
  const tree = parseJson(
    ghApi(`repos/${repository}/git/trees/${ref}?recursive=1`),
  ) as GhTree;
  return tree.tree
    .filter((entry) => entry.type === "blob" && isMigrationSqlPath(entry.path))
    .map((entry) => entry.path)
    .sort();
}

function fetchFileAtRef(repository: string, path: string, ref: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const data = parseJson(
    ghApi(`repos/${repository}/contents/${encoded}?ref=${ref}`),
  ) as GhContent;
  return decodeContent(data);
}

function fetchCompare(repository: string, base: string, head: string) {
  const stdout = ghApiPaginateSlurp(`repos/${repository}/compare/${base}...${head}`);
  const parsed = parseJson(stdout);
  if (Array.isArray(parsed) && parsed.length > 0) {
    const last = parsed[parsed.length - 1];
    if (last && typeof last === "object") {
      return last as {
        status?: string;
        ahead_by?: number;
        behind_by?: number;
        files?: unknown[];
      };
    }
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as {
      status?: string;
      ahead_by?: number;
      behind_by?: number;
      files?: unknown[];
    };
  }
  return null;
}

function mergeCompareFiles(rawFiles: unknown[]) {
  const rawByName = new Map<string, { previous_filename?: string }>();
  for (const entry of rawFiles) {
    if (entry && typeof entry === "object" && "filename" in entry) {
      const filename = (entry as { filename: string }).filename;
      rawByName.set(filename, {
        previous_filename:
          "previous_filename" in entry &&
          typeof (entry as { previous_filename?: string }).previous_filename ===
            "string"
            ? (entry as { previous_filename: string }).previous_filename
            : undefined,
      });
    }
  }
  const parsed = parsePullRequestFilesApiStdout(JSON.stringify(rawFiles));
  return parsed.map((file) => ({
    ...file,
    previous_filename: rawByName.get(file.filename)?.previous_filename,
  }));
}

function findIntroduction(repository: string, path: string, headSha: string) {
  try {
    const commitsStdout = ghApi(
      `repos/${repository}/commits?path=${encodeURIComponent(path)}&sha=${headSha}&per_page=1`,
    );
    const commits = parseJson(commitsStdout);
    if (!Array.isArray(commits) || commits.length === 0) {
      return formatMigrationIntroduction({});
    }
    const commit = commits[0] as { sha?: string };
    const commitSha = commit.sha ?? null;
    if (!commitSha) {
      return formatMigrationIntroduction({});
    }
    let prNumber: number | null = null;
    let prTitle: string | null = null;
    try {
      const pullsStdout = ghApi(`repos/${repository}/commits/${commitSha}/pulls`);
      const pulls = parseJson(pullsStdout);
      if (Array.isArray(pulls) && pulls.length > 0) {
        const pr = pulls[0] as { number?: number; title?: string };
        prNumber = pr.number ?? null;
        prTitle = pr.title ?? null;
      }
    } catch {
      // PR linkage is best-effort
    }
    return formatMigrationIntroduction({ commitSha, prNumber, prTitle });
  } catch {
    return formatMigrationIntroduction({});
  }
}

function main() {
  const repository = requireEnv("GITHUB_REPOSITORY");
  const headSha = requireEnv("GITHUB_SHA");

  const deployments = listProductionDeployments(repository);
  const baselineSha = pickBaselineShaFromDeployments(deployments, (deploymentId) =>
    latestDeploymentStatus(repository, deploymentId),
  );

  const allMigrationPathsAtHead = listMigrationPathsAtRef(repository, headSha);

  const compare =
    baselineSha != null ? fetchCompare(repository, baselineSha, headSha) : null;
  const compareForDecision =
    compare != null
      ? {
          ...compare,
          files: compare.files != null ? mergeCompareFiles(compare.files) : [],
        }
      : null;

  const plan = decideMigrationPlan({
    baselineSha,
    compare: compareForDecision,
    allMigrationPathsAtHead,
  });

  const migrationSections: string[] = [];
  const pathsForAnnotation: string[] = [];
  let lintWarningCount = 0;

  for (const migration of plan.migrations) {
    const path = migration.path;
    pathsForAnnotation.push(path);
    const sql = fetchFileAtRef(repository, path, headSha);
    const lintWarnings = collectAdvisoryLintWarnings(path, sql);
    lintWarningCount += lintWarnings.length;
    for (const warning of lintWarnings) {
      emitWorkflowWarning(warning);
    }
    migrationSections.push(
      formatMigrationSection({
        path,
        changeKind: migration.changeKind,
        previousPath: "previousPath" in migration ? migration.previousPath : undefined,
        introduction: findIntroduction(repository, path, headSha),
        sql,
        lintWarnings,
      }),
    );
  }

  const summary = buildPlanSummaryMarkdown({
    headSha,
    baselineSha,
    plan,
    migrationSections,
  });
  writeSummary(summary);

  const annotation = buildWarningAnnotation({ migrationPaths: pathsForAnnotation });
  if (annotation) {
    emitWorkflowWarning(annotation);
  }

  console.log("deploy-production plan: complete");
  process.exit(resolvePlanExitCode({ lintWarningCount }));
}

main();
