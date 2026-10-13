#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  analyzePrivilegedChange,
  privilegedChangeCheckState,
} from "./lib/privileged-change-analyze.mjs";
import {
  ensurePrivilegedChangeLabels,
  privilegedChangeLabel,
} from "./lib/privileged-change-labels.mjs";
import { isWorkflowFile } from "./lib/privileged-paths.mjs";
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

function run() {
  const repo = process.env.REPOSITORY ?? process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;
  const headSha = process.env.HEAD_SHA;
  const trustedOrg = process.env.TRUSTED_ORG;

  if (!repo || !prNumber || !headSha || !trustedOrg) {
    console.error(
      "Set REPOSITORY (or GITHUB_REPOSITORY), PR_NUMBER, HEAD_SHA, and TRUSTED_ORG",
    );
    process.exit(1);
  }

  ensurePrivilegedChangeLabels(repo);

  const filesJson = ghApi([`repos/${repo}/pulls/${prNumber}/files`, "--paginate"]);
  /** @type {{ filename: string; status: string }[]} */
  const changedFiles = JSON.parse(filesJson).map((f) => ({
    filename: f.filename,
    status: f.status,
  }));

  const prJson = ghApi([`repos/${repo}/pulls/${prNumber}`]);
  const pr = JSON.parse(prJson);
  const prLabels = (pr.labels ?? []).map((l) => l.name);

  /** @type {Record<string, string>} */
  const workflowContentsByPath = {};
  for (const file of changedFiles) {
    if (!isWorkflowFile(file.filename)) {
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

  const body = buildPrivilegedChangeCommentBody(analysis);
  const commentIds = execFileSync(
    "gh",
    [
      "api",
      `repos/${repo}/issues/${prNumber}/comments`,
      "--paginate",
      "--jq",
      `.[] | select(.user.login == "github-actions[bot]" and (.body | contains("${MARKER}"))) | .id`,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        GH_TOKEN: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN,
      },
    },
  ).trim();
  const commentId = commentIds.split("\n")[0]?.trim();
  const commentPayload = JSON.stringify({ body });
  if (commentId) {
    ghApi(
      ["--method", "PATCH", `repos/${repo}/issues/comments/${commentId}`],
      commentPayload,
    );
  } else {
    ghApi(
      ["--method", "POST", `repos/${repo}/issues/${prNumber}/comments`],
      commentPayload,
    );
  }

  const hasFlagLabel = prLabels.includes(privilegedChangeLabel);
  if (analysis.flagged && !hasFlagLabel) {
    execFileSync(
      "gh",
      ["pr", "edit", prNumber, "--repo", repo, "--add-label", privilegedChangeLabel],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          GH_TOKEN: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN,
        },
      },
    );
  } else if (!analysis.flagged && hasFlagLabel) {
    execFileSync(
      "gh",
      ["pr", "edit", prNumber, "--repo", repo, "--remove-label", privilegedChangeLabel],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          GH_TOKEN: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN,
        },
      },
    );
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
      privilegedFileCount: analysis.privilegedFiles.length,
      findingCount: analysis.findings.length,
    }),
  );
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  run();
}
