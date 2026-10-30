/**
 * Parse `gh api .../pulls/{n}/files` stdout (flat array, --slurp page arrays, or one array per line).
 *
 * @param {unknown} parsed
 * @returns {unknown[]}
 */
export function flattenPullFilesPayload(parsed) {
  if (!Array.isArray(parsed)) {
    throw new TypeError("pull files API output is not an array");
  }
  if (parsed.length > 0 && parsed.every((item) => Array.isArray(item))) {
    return parsed.flat();
  }
  return parsed;
}

/**
 * @typedef {{ filename: string; status: string; previous_filename?: string }} PullRequestChangedFile
 */

/**
 * @param {unknown} entry
 * @param {number} index
 * @returns {PullRequestChangedFile}
 */
export function normalizePullFileEntry(entry, index) {
  if (!entry || typeof entry !== "object") {
    throw new TypeError(`pull files API entry ${index} is not an object`);
  }
  const record =
    /** @type {{ filename?: unknown; status?: unknown; previous_filename?: unknown }} */ (
      entry
    );
  if (typeof record.filename !== "string" || record.filename.length === 0) {
    throw new TypeError(`pull files API entry ${index} missing string filename`);
  }
  if (typeof record.status !== "string" || record.status.length === 0) {
    throw new TypeError(`pull files API entry ${index} missing string status`);
  }
  /** @type {PullRequestChangedFile} */
  const normalized = { filename: record.filename, status: record.status };
  if (
    record.status === "renamed" &&
    typeof record.previous_filename === "string" &&
    record.previous_filename.length > 0
  ) {
    normalized.previous_filename = record.previous_filename;
  }
  return normalized;
}

/**
 * Paths to match against privileged path rules for one pull file entry.
 * Fail closed: renamed entries without previous_filename only consider the new path.
 *
 * @param {PullRequestChangedFile} file
 * @returns {string[]}
 */
export function pathsConsideredForPrivilegedGate(file) {
  const paths = [file.filename];
  if (
    file.status === "renamed" &&
    typeof file.previous_filename === "string" &&
    file.previous_filename.length > 0
  ) {
    paths.push(file.previous_filename);
  }
  return paths;
}

/**
 * @param {PullRequestChangedFile[]} changedFiles
 * @param {(filename: string) => boolean} isPrivilegedPathFn
 * @returns {string[]}
 */
export function privilegedFilenamesFromChangedFiles(changedFiles, isPrivilegedPathFn) {
  /** @type {Set<string>} */
  const privileged = new Set();
  for (const file of changedFiles) {
    for (const path of pathsConsideredForPrivilegedGate(file)) {
      if (isPrivilegedPathFn(path)) {
        privileged.add(path);
      }
    }
  }
  return [...privileged].sort();
}

/**
 * Parse `gh api --paginate --slurp` stdout (nested page arrays) or a single JSON array.
 *
 * @param {string} stdout
 * @returns {unknown[]}
 */
export function parseGhApiPaginatedSlurpedStdout(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      return flattenPullFilesPayload(JSON.parse(trimmed));
    } catch {
      // fall through
    }
  }

  const lines = trimmed.split("\n").filter((line) => line.trim());
  if (lines.length === 1 && lines[0].startsWith("[")) {
    return flattenPullFilesPayload(JSON.parse(lines[0]));
  }

  /** @type {unknown[]} */
  const rawEntries = [];
  for (const line of lines) {
    const parsed = JSON.parse(line);
    if (Array.isArray(parsed)) {
      rawEntries.push(...flattenPullFilesPayload(parsed));
    } else {
      rawEntries.push(parsed);
    }
  }
  return rawEntries;
}

/**
 * @param {string} stdout
 * @returns {PullRequestChangedFile[]}
 */
export function parsePullRequestFilesApiStdout(stdout) {
  const rawEntries = parseGhApiPaginatedSlurpedStdout(stdout);
  return rawEntries.map((entry, index) => normalizePullFileEntry(entry, index));
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function shouldFetchWorkflowFileContent(status) {
  return status !== "removed";
}
