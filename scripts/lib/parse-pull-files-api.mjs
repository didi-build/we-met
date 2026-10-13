/**
 * Parse `gh api .../pulls/{n}/files` stdout (single array, --slurp, or one array per line).
 *
 * @param {string} stdout
 * @returns {{ filename: string; status: string }[]}
 */
export function parsePullRequestFilesApiStdout(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }

  const lines = trimmed.split("\n").filter((line) => line.trim());
  /** @type {unknown[]} */
  let rawEntries = [];

  if (lines.length === 1 && lines[0].startsWith("[")) {
    rawEntries = JSON.parse(lines[0]);
  } else {
    for (const line of lines) {
      const parsed = JSON.parse(line);
      if (Array.isArray(parsed)) {
        rawEntries.push(...parsed);
      } else {
        rawEntries.push(parsed);
      }
    }
  }

  if (!Array.isArray(rawEntries)) {
    throw new TypeError("pull files API output is not an array");
  }

  return rawEntries.map((entry) => {
    const file = /** @type {{ filename: string; status: string }} */ (entry);
    return { filename: file.filename, status: file.status };
  });
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function shouldFetchWorkflowFileContent(status) {
  return status !== "removed";
}
