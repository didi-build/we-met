#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  analyzePrivilegedChange,
  privilegedChangeCheckState,
} from "./lib/privileged-change-analyze.mjs";
import { decidePrivilegedChangeCommentAction } from "./lib/privileged-change-comment-lifecycle.mjs";
import {
  addIssueLabels,
  ensurePrivilegedChangeLabels,
  privilegedChangeLabel,
  privilegedChangeReviewedLabel,
  removeIssueLabel,
} from "./lib/privileged-change-labels.mjs";
import {
  parsePullRequestFilesApiStdout,
  shouldFetchWorkflowFileContent,
} from "./lib/privileged-pull-files-api.mjs";
import { shouldClearStalePrivilegedReview } from "./lib/privileged-change-stale-review.mjs";
import { isWorkflowFile } from "./lib/privileged-paths.mjs";
import { privilegedChangeErrorStatusPayload } from "./lib/privileged-change-status.mjs";
import { buildPrivilegedChangeCommentBody } from "./privileged-change-comment-body.mjs";

const MARKER = "<!-- we-met-privileged-change -->";

function ghEnv() {
  return {
    ...process.env,
    GH_TOKEN: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN,
  };
}

function ghApi(args, input) {
  return execFileSync("gh", ["api", ...args], {
    encoding: "utf8",
    input,
    env: ghEnv(),
  });
}

/**
 * @param {string} repo
 * @param {string} headSha
 */
export function postPrivilegedChangeErrorStatus(repo, headSha) {
  ghApi(
    ["--method", "POST", `repos/${repo}/statuses/${headSha}`],
    JSON.stringify(privilegedChangeErrorStatusPayload()),
  );
}

function findMarkerCommentId(repo, prNumber) {
  const commentIds = execFileSync(
    "gh",
    [
      "api",
      `repos/${repo}/issues/${prNumber}/comments`,
      "--paginate",
      "--jq",
      `.[] | select(.user.login == "github-actions[bot]" and (.body | contains("${MARKER}"))) | .id`,
    ],
    { encoding: "utf8", env: ghEnv() },
  ).trim();
  const commentId = commentIds.split("\n")[0]?.trim();
  return commentId || null;
}

function run() {
  const repo = process.env.REPOSITORY ?? process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;
  const headSha = process.env.HEAD_SHA;
  const trustedOrg = process.env.TRUSTED_ORG;
  const eventAction = process.env.EVENT_ACTION ?? "";

  if (!repo || !prNumber || !headSha || !trustedOrg) {
    console.error(
      "Set REPOSITORY (or GITHUB_REPOSITORY), PR_NUMBER, HEAD_SHA, and TRUSTED_ORG",
    );
    process.exit(1);
  }

  try {
    ensurePrivilegedChangeLabels(repo);

    const filesStdout = ghApi([
      `repos/${repo}/pulls/${prNumber}/files?per_page=100`,
      "--paginate",
      "--slurp",
    ]);
    const changedFiles = parsePullRequestFilesApiStdout(filesStdout);

    const prJson = ghApi([`repos/${repo}/pulls/${prNumber}`]);
    const pr = JSON.parse(prJson);
    let prLabels = (pr.labels ?? []).map((l) => l.name);

    /** @type {Record<string, string>} */
    const workflowContentsByPath = {};
    for (const file of changedFiles) {
      if (!isWorkflowFile(file.filename)) {
        continue;
      }
      if (!shouldFetchWorkflowFileContent(file.status)) {
        continue;
      }
      const encoded = file.filename
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
      const contentJson = ghApi([`repos/${repo}/contents/${encoded}?ref=${headSha}`]);
      const payload = JSON.parse(contentJson);
      if (payload.content && payload.encoding === "base64") {
        workflowContentsByPath[file.filename] = Buffer.from(
          payload.content,
          "base64",
        ).toString("utf8");
      }
    }

    const analysis = analyzePrivilegedChange(changedFiles, workflowContentsByPath, {
      trustedOrg,
    });

    const staleReviewCleared = shouldClearStalePrivilegedReview(
      eventAction,
      analysis.flagged,
      prLabels,
    );
    if (staleReviewCleared) {
      removeIssueLabel(repo, prNumber, privilegedChangeReviewedLabel);
      prLabels = prLabels.filter((name) => name !== privilegedChangeReviewedLabel);
    }

    const existingCommentId = findMarkerCommentId(repo, prNumber);
    const commentAction = decidePrivilegedChangeCommentAction(
      analysis.flagged,
      existingCommentId !== null,
    );

    if (commentAction !== "skip") {
      const body = buildPrivilegedChangeCommentBody(analysis, {
        staleReviewNotice: staleReviewCleared && analysis.flagged,
      });
      const commentPayload = JSON.stringify({ body });
      if (commentAction === "update" && existingCommentId) {
        ghApi(
          ["--method", "PATCH", `repos/${repo}/issues/comments/${existingCommentId}`],
          commentPayload,
        );
      } else {
        ghApi(
          ["--method", "POST", `repos/${repo}/issues/${prNumber}/comments`],
          commentPayload,
        );
      }
    }

    const hasFlagLabel = prLabels.includes(privilegedChangeLabel);
    if (analysis.flagged && !hasFlagLabel) {
      addIssueLabels(repo, prNumber, [privilegedChangeLabel]);
    } else if (!analysis.flagged && hasFlagLabel) {
      removeIssueLabel(repo, prNumber, privilegedChangeLabel);
    }

    const checkState = privilegedChangeCheckState(analysis.flagged, prLabels);
    const description =
      checkState === "success"
        ? analysis.flagged
          ? "Privileged change reviewed"
          : "No privileged paths changed"
        : "Privileged change needs maintainer review (add privileged-change-reviewed)";

    ghApi(
      ["--method", "POST", `repos/${repo}/statuses/${headSha}`],
      JSON.stringify({
        state: checkState,
        context: "privileged-change",
        description,
      }),
    );

    console.log(
      JSON.stringify({
        flagged: analysis.flagged,
        checkState,
        commentAction,
        staleReviewCleared,
        privilegedFileCount: analysis.privilegedFiles.length,
        findingCount: analysis.findings.length,
      }),
    );
  } catch (err) {
    try {
      postPrivilegedChangeErrorStatus(repo, headSha);
    } catch (statusErr) {
      console.error("Failed to post privileged-change error status:", statusErr);
    }
    console.error(err);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  run();
}
