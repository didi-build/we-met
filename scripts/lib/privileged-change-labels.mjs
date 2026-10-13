import { execFileSync } from "node:child_process";
import { shouldIgnoreIssueLabelDeleteError } from "./gh-api-errors.mjs";

export const privilegedChangeLabel = "privileged-change";
export const privilegedChangeReviewedLabel = "privileged-change-reviewed";

/** @type {{ name: string; color: string; description: string }[]} */
const LABELS = [
  {
    name: privilegedChangeLabel,
    color: "B60205",
    description: "PR touches privileged deploy or workflow paths (review required)",
  },
  {
    name: privilegedChangeReviewedLabel,
    color: "0E8A16",
    description: "Maintainer reviewed privileged-change warning",
  },
];

function ghEnv() {
  return {
    ...process.env,
    GH_TOKEN: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN,
  };
}

/**
 * @param {string} repo
 */
export function ensurePrivilegedChangeLabels(repo) {
  const names = JSON.parse(
    execFileSync(
      "gh",
      ["label", "list", "--repo", repo, "--limit", "200", "--json", "name"],
      { encoding: "utf8", env: ghEnv() },
    ),
  ).map((l) => l.name);

  for (const label of LABELS) {
    if (names.includes(label.name)) {
      continue;
    }
    execFileSync(
      "gh",
      [
        "label",
        "create",
        label.name,
        "--repo",
        repo,
        "--color",
        label.color,
        "--description",
        label.description,
      ],
      { stdio: "inherit", env: ghEnv() },
    );
  }
}

/**
 * @param {string} repo
 * @param {string | number} issueNumber
 * @param {string[]} labels
 */
export function addIssueLabels(repo, issueNumber, labels) {
  if (labels.length === 0) {
    return;
  }
  execFileSync(
    "gh",
    ["api", "--method", "POST", `repos/${repo}/issues/${issueNumber}/labels`],
    {
      encoding: "utf8",
      input: JSON.stringify({ labels }),
      env: ghEnv(),
    },
  );
}

/**
 * @param {string} repo
 * @param {string | number} issueNumber
 * @param {string} label
 */
export function removeIssueLabel(repo, issueNumber, label) {
  try {
    execFileSync(
      "gh",
      [
        "api",
        "--method",
        "DELETE",
        `repos/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`,
      ],
      { encoding: "utf8", env: ghEnv(), stdio: "pipe" },
    );
  } catch (err) {
    const stderr =
      err &&
      typeof err === "object" &&
      "stderr" in err &&
      typeof err.stderr === "string"
        ? err.stderr
        : String(err);
    if (shouldIgnoreIssueLabelDeleteError(stderr)) {
      return;
    }
    throw err;
  }
}
