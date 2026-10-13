import { spawnSync } from "node:child_process";
import { parseGhApiPaginatedSlurpedStdout } from "../lib/privileged-pull-files-api.mjs";
import { MIGRATE_NONPROD_MARKER } from "./comment-body.mjs";

function ghApi(args) {
  const result = spawnSync("gh", ["api", ...args], {
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "gh api failed");
  }
  return result.stdout;
}

/**
 * @param {string} repository
 * @param {string} prNumber
 * @returns {unknown[]}
 */
export function listIssueComments(repository, prNumber) {
  const stdout = ghApi([
    `repos/${repository}/issues/${prNumber}/comments`,
    "--paginate",
    "--slurp",
  ]);
  return parseGhApiPaginatedSlurpedStdout(stdout);
}

/**
 * @param {string} repository
 * @param {string} prNumber
 * @returns {string | null}
 */
export function findMigrateNonprodBotCommentBody(repository, prNumber) {
  const comments = listIssueComments(repository, prNumber);
  const existing = comments.find(
    (c) =>
      c &&
      typeof c === "object" &&
      /** @type {{ user?: { login?: string }; body?: string }} */ (c).user?.login ===
        "github-actions[bot]" &&
      typeof (/** @type {{ body?: string }} */ (c).body) === "string" &&
      /** @type {{ body: string }} */ (c).body.includes(MIGRATE_NONPROD_MARKER),
  );
  return existing && typeof existing === "object" && typeof existing.body === "string"
    ? existing.body
    : null;
}
