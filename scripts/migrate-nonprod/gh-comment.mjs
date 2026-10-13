import { spawnSync } from "node:child_process";
import { findMigrateNonprodBotComment, listIssueComments } from "./gh-api-comments.mjs";

function ghApi(args, input) {
  const result = spawnSync("gh", ["api", ...args], {
    encoding: "utf8",
    env: process.env,
    input,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "gh api failed");
  }
  return result.stdout;
}

/**
 * @param {{ repository: string, prNumber: string, body: string }} opts
 */
export function upsertMigrateNonprodComment(opts) {
  const { repository, prNumber, body } = opts;
  const comments = listIssueComments(repository, prNumber);
  const existing = findMigrateNonprodBotComment(comments);
  const payload = JSON.stringify({ body });
  if (existing) {
    const commentId = /** @type {{ id: number }} */ (existing).id;
    ghApi(
      [
        "--method",
        "PATCH",
        `repos/${repository}/issues/comments/${commentId}`,
        "--input",
        "-",
      ],
      payload,
    );
    return;
  }
  ghApi(
    [
      "--method",
      "POST",
      `repos/${repository}/issues/${prNumber}/comments`,
      "--input",
      "-",
    ],
    payload,
  );
}
