import { spawnSync } from "node:child_process";
import { MIGRATE_NONPROD_MARKER } from "./comment-body.mjs";

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
  const commentsJson = ghApi([
    `repos/${repository}/issues/${prNumber}/comments`,
    "--paginate",
  ]);
  const comments = JSON.parse(commentsJson);
  const existing = comments.find(
    (c) =>
      c.user?.login === "github-actions[bot]" &&
      typeof c.body === "string" &&
      c.body.includes(MIGRATE_NONPROD_MARKER),
  );
  const payload = JSON.stringify({ body });
  if (existing) {
    ghApi(
      [
        "--method",
        "PATCH",
        `repos/${repository}/issues/comments/${existing.id}`,
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
