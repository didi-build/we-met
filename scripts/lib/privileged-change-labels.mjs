import { execFileSync } from "node:child_process";

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

/**
 * @param {string} repo
 */
export function ensurePrivilegedChangeLabels(repo) {
  const names = JSON.parse(
    execFileSync(
      "gh",
      ["label", "list", "--repo", repo, "--limit", "200", "--json", "name"],
      { encoding: "utf8" },
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
      { stdio: "inherit" },
    );
  }
}
